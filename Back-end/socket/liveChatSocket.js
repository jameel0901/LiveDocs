const {
  LiveChatIdentity,
  LiveChatConversation,
  LiveChatMessage,
} = require("../utils/model");
const { hashAppUser } = require("../utils/liveChatCrypto");
const { jwtSecret } = require("../config/env");

const getAppUserHash = (userId) => hashAppUser(userId, jwtSecret);

const registerLiveChatSockets = (io) => {
  io.on("connection", (socket) => {
    let liveChatIdentityHash = null;

    socket.on("livechat-register-socket", async (payload, ack) => {
      try {
        const appUserIdHash = getAppUserHash(socket.data.userId);
        const identity = await LiveChatIdentity.findOne({ appUserIdHash })
          .select("identityHash -_id")
          .lean();

        if (!identity) {
          if (typeof ack === "function") ack({ ok: false, error: "Identity not registered" });
          return;
        }

        liveChatIdentityHash = identity.identityHash;
        socket.join(`livechat:${liveChatIdentityHash}`);
        if (typeof ack === "function") ack({ ok: true, identityHash: liveChatIdentityHash });
      } catch {
        if (typeof ack === "function") ack({ ok: false, error: "Registration failed" });
      }
    });

    socket.on("livechat-join-conversation", async ({ conversationId }, ack) => {
      if (!conversationId) {
        if (typeof ack === "function") ack({ ok: false, error: "conversationId required" });
        return;
      }

      if (!liveChatIdentityHash) {
        if (typeof ack === "function") ack({ ok: false, error: "Identity not registered on socket" });
        return;
      }

      const conversation = await LiveChatConversation.findOne({ conversationId }).lean();
      if (!conversation || !conversation.participants.includes(liveChatIdentityHash)) {
        if (typeof ack === "function") ack({ ok: false, error: "Conversation not found" });
        return;
      }

      socket.join(`livechat-conv:${conversationId}`);
      if (typeof ack === "function") ack({ ok: true });
    });

    socket.on("livechat-leave-conversation", ({ conversationId }) => {
      if (conversationId) socket.leave(`livechat-conv:${conversationId}`);
    });

    socket.on("livechat-send-message", async (payload, ack) => {
      try {
        const {
          conversationId,
          ciphertext,
          nonce,
          payloadType,
          messageId,
          senderIdentityHash,
        } = payload || {};

        if (!conversationId || !ciphertext || !nonce || !messageId || !senderIdentityHash) {
          if (typeof ack === "function") ack({ ok: false, error: "Invalid message payload" });
          return;
        }

        if (senderIdentityHash !== liveChatIdentityHash) {
          if (typeof ack === "function") ack({ ok: false, error: "Sender mismatch" });
          return;
        }

        const conversation = await LiveChatConversation.findOne({ conversationId }).lean();
        if (!conversation || !conversation.participants.includes(liveChatIdentityHash)) {
          if (typeof ack === "function") ack({ ok: false, error: "Access denied" });
          return;
        }

        const message = await LiveChatMessage.create({
          messageId,
          conversationId,
          senderIdentityHash,
          ciphertext,
          nonce,
          payloadType: payloadType || "text",
        });

        await LiveChatConversation.updateOne(
          { conversationId },
          { $set: { lastMessageAt: new Date() } }
        );

        const event = {
          messageId: message.messageId,
          conversationId,
          senderIdentityHash,
          ciphertext,
          nonce,
          payloadType: message.payloadType,
          createdAt: message.createdAt,
        };

        for (const participant of conversation.participants) {
          if (participant !== liveChatIdentityHash) {
            io.to(`livechat:${participant}`).emit("livechat-inbound", event);
          }
        }

        if (typeof ack === "function") ack({ ok: true, messageId });
      } catch {
        if (typeof ack === "function") ack({ ok: false, error: "Send failed" });
      }
    });

    socket.on("livechat-typing", ({ conversationId }) => {
      if (!conversationId) return;
      socket.to(`livechat-conv:${conversationId}`).emit("livechat-typing", {
        conversationId,
        identityHash: liveChatIdentityHash,
      });
    });

    socket.on("livechat-delivered", async ({ conversationId, messageId }) => {
      if (!conversationId || !messageId) return;

      const conversation = await LiveChatConversation.findOne({ conversationId })
        .select("participants")
        .lean();
      if (!conversation) return;

      const receipt = { messageId, identityHash: liveChatIdentityHash, conversationId };
      for (const participant of conversation.participants) {
        if (participant !== liveChatIdentityHash) {
          io.to(`livechat:${participant}`).emit("livechat-delivered", receipt);
        }
      }
    });

    socket.on("livechat-call-offer", ({ sessionHash, encryptedSignal, targetIdentityHash }) => {
      if (!sessionHash || !encryptedSignal || !targetIdentityHash) return;
      io.to(`livechat:${targetIdentityHash}`).emit("livechat-call-incoming", {
        sessionHash,
        encryptedSignal,
        fromIdentityHash: liveChatIdentityHash,
      });
    });

    socket.on("livechat-call-answer", ({ sessionHash, encryptedSignal, targetIdentityHash }) => {
      if (!sessionHash || !encryptedSignal || !targetIdentityHash) return;
      io.to(`livechat:${targetIdentityHash}`).emit("livechat-call-answer", {
        sessionHash,
        encryptedSignal,
        fromIdentityHash: liveChatIdentityHash,
      });
    });

    socket.on("livechat-call-ice", ({ sessionHash, encryptedCandidate, targetIdentityHash }) => {
      if (!sessionHash || !encryptedCandidate || !targetIdentityHash) return;
      io.to(`livechat:${targetIdentityHash}`).emit("livechat-call-ice", {
        sessionHash,
        encryptedCandidate,
        fromIdentityHash: liveChatIdentityHash,
      });
    });

    socket.on("livechat-call-reject", ({ sessionHash, targetIdentityHash }) => {
      if (targetIdentityHash) {
        io.to(`livechat:${targetIdentityHash}`).emit("livechat-call-rejected", { sessionHash });
      }
    });

    socket.on("livechat-call-end", ({ sessionHash, targetIdentityHash }) => {
      if (targetIdentityHash) {
        io.to(`livechat:${targetIdentityHash}`).emit("livechat-call-ended", { sessionHash });
      }
    });

    socket.on("disconnect", () => {
      liveChatIdentityHash = null;
    });
  });
};

module.exports = { registerLiveChatSockets };
