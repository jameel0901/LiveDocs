const { Document, Users } = require("../utils/model");
const { getDocumentAccess, canEdit } = require("../utils/documentAccess");
const {
  resolveDocumentSegments,
  normalizeSegments,
  segmentsToText,
} = require("../utils/segments");
const { getUserColor } = require("../utils/userColors");
const {
  addSocketToDocument,
  removeSocketFromDocument,
  removeSocketFromAllDocuments,
  setUserTyping,
  getPresenceList,
  subscribePresence,
  unsubscribePresence,
  getPresenceSubscribers,
  buildPresenceSnapshot,
} = require("../utils/presence");

const typingTimers = new Map();

const getAccessibleDocumentIds = async (userId) => {
  const docs = await Document.find({
    $or: [{ owner: userId }, { "sharedWith.user": userId }],
  })
    .select("_id")
    .lean();

  return docs.map((doc) => doc._id);
};

const getUsersWithDocumentAccess = (doc) => {
  const userIds = new Set();

  if (doc.owner) {
    userIds.add(doc.owner.toString());
  }

  (doc.sharedWith || []).forEach((entry) => {
    if (entry.user) {
      userIds.add(entry.user.toString());
    }
  });

  return Array.from(userIds);
};

const broadcastPresenceUpdate = async (io, documentId) => {
  const doc = await Document.findById(documentId).lean();
  if (!doc) return;

  const payload = {
    documentId,
    users: getPresenceList(documentId),
  };

  io.to(documentId).emit("presence-update", payload);

  const userIds = getUsersWithDocumentAccess(doc);
  userIds.forEach((userId) => {
    getPresenceSubscribers(userId).forEach((socketId) => {
      io.to(socketId).emit("presence-update", payload);
    });
  });
};

const clearTypingLater = (io, documentId, userId, delay = 1800) => {
  const key = `${documentId}:${userId}`;
  if (typingTimers.has(key)) {
    clearTimeout(typingTimers.get(key));
  }

  typingTimers.set(
    key,
    setTimeout(async () => {
      setUserTyping(documentId, userId, false);
      await broadcastPresenceUpdate(io, documentId);
      typingTimers.delete(key);
    }, delay)
  );
};

const registerDocumentSockets = (io) => {
  io.on("connection", (socket) => {
    socket.on("subscribe-presence", async () => {
      try {
        subscribePresence(socket.data.userId, socket.id);
        socket.data.subscribedPresence = true;

        const documentIds = await getAccessibleDocumentIds(socket.data.userId);
        socket.data.accessibleDocs = documentIds;
        socket.emit("presence-snapshot", buildPresenceSnapshot(documentIds));
      } catch (error) {
        socket.emit("error", { message: "Failed to subscribe to presence" });
      }
    });

    socket.on("join-document", async (documentId) => {
      try {
        const access = await getDocumentAccess(documentId, socket.data.userId);

        if (!access.allowed) {
          socket.emit("error", { message: "You do not have access to this document" });
          return;
        }

        const user = await Users.findById(socket.data.userId).select("name").lean();
        socket.data.userName = user?.name || "User";

        if (socket.data.documentId && socket.data.documentId !== documentId) {
          removeSocketFromDocument(socket.data.documentId, socket);
          await broadcastPresenceUpdate(io, socket.data.documentId);
        }

        socket.join(documentId);
        socket.data.documentId = documentId;
        socket.data.permission = access.permission;

        addSocketToDocument(documentId, socket);

        const fallbackAuthor = {
          authorId: socket.data.userId,
          authorName: socket.data.userName,
        };
        const segments = resolveDocumentSegments(access.doc, fallbackAuthor);
        const content = segmentsToText(segments);

        socket.emit("document", content);
        socket.emit("document-segments", segments);
        socket.emit("permission", access.permission);
        socket.emit("active-users", getPresenceList(documentId));

        socket.to(documentId).emit("active-users", getPresenceList(documentId));
        await broadcastPresenceUpdate(io, documentId);
      } catch (error) {
        socket.emit("error", { message: "Failed to join document" });
      }
    });

    socket.on("typing", async () => {
      const documentId = socket.data.documentId;
      if (!documentId) return;

      setUserTyping(documentId, socket.data.userId, true);
      await broadcastPresenceUpdate(io, documentId);
      clearTypingLater(io, documentId, socket.data.userId);
    });

    socket.on("edit-document", async (payload) => {
      try {
        const documentId = socket.data.documentId;

        if (!documentId) {
          socket.emit("error", { message: "Join a document before editing" });
          return;
        }

        if (!canEdit(socket.data.permission)) {
          socket.emit("error", {
            message: "You only have view access to this document",
          });
          return;
        }

        const fallbackAuthor = {
          authorId: socket.data.userId,
          authorName: socket.data.userName || "User",
        };

        let segments = [];
        let content = "";

        if (typeof payload === "string") {
          content = payload;
          segments = [
            {
              authorId: fallbackAuthor.authorId,
              authorName: fallbackAuthor.authorName,
              color: getUserColor(fallbackAuthor.authorId),
              text: content,
            },
          ];
        } else {
          content = payload?.content || "";
          segments = normalizeSegments(payload?.segments, fallbackAuthor);
          if (segments.length === 0 && content) {
            segments = [
              {
                authorId: fallbackAuthor.authorId,
                authorName: fallbackAuthor.authorName,
                color: getUserColor(fallbackAuthor.authorId),
                text: content,
              },
            ];
          }
        }

        await Document.findByIdAndUpdate(documentId, { content, contentSegments: segments });

        setUserTyping(documentId, socket.data.userId, true);
        clearTypingLater(io, documentId, socket.data.userId);

        socket.to(documentId).emit("document", content);
        socket.to(documentId).emit("document-segments", segments);
        await broadcastPresenceUpdate(io, documentId);
      } catch (error) {
        socket.emit("error", { message: "Failed to save changes" });
      }
    });

    socket.on("leave-document", async () => {
      if (!socket.data.documentId) return;

      const documentId = socket.data.documentId;
      removeSocketFromDocument(documentId, socket);
      socket.leave(documentId);
      socket.data.documentId = null;
      socket.data.permission = null;

      io.to(documentId).emit("active-users", getPresenceList(documentId));
      await broadcastPresenceUpdate(io, documentId);
    });

    socket.on("disconnect", async () => {
      if (socket.data.subscribedPresence) {
        unsubscribePresence(socket.data.userId, socket.id);
      }

      const affectedDocuments = removeSocketFromAllDocuments(socket);

      if (socket.data.documentId) {
        io.to(socket.data.documentId).emit(
          "active-users",
          getPresenceList(socket.data.documentId)
        );
      }

      await Promise.all(
        affectedDocuments.map((documentId) => broadcastPresenceUpdate(io, documentId))
      );
    });
  });
};

module.exports = { registerDocumentSockets, getAccessibleDocumentIds };
