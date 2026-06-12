const { Document, Users, Network } = require("../utils/model");
const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const { getDocumentAccess, canEdit } = require("../utils/documentAccess");
const { isNetworkMember, getUserNetworkIds } = require("../utils/networkAccess");
const {
  resolveDocumentSegments,
  normalizeSegments,
  segmentsToText,
} = require("../utils/segments");
const { getUserColor } = require("../utils/userColors");
const { promoteAdminIfListed } = require("../utils/adminEmails");

const getOrCreateDocument = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const access = await getDocumentAccess(id, req.user.id);

  if (!access.allowed) {
    res.status(403);
    throw new Error("You do not have access to this document");
  }

  const fallbackAuthor = {
    authorId: req.user.id,
    authorName: (await Users.findById(req.user.id).select("name").lean())?.name || "User",
  };
  const contentSegments = resolveDocumentSegments(access.doc, fallbackAuthor);

  res.json({
    ...access.doc.toObject(),
    content: segmentsToText(contentSegments),
    contentSegments,
    permission: access.permission,
  });
});

const resolveNetworkSettings = async (userId, networkId, networkVisible) => {
  if (!networkId || !networkVisible) {
    return { networkId: null, networkVisible: false };
  }

  const member = await isNetworkMember(networkId, userId);
  if (!member) {
    return {
      error: "You can only share documents in networks you belong to",
      status: 403,
    };
  }

  return {
    networkId,
    networkVisible: true,
  };
};

const createDocument = asyncHandler(async (req, res) => {
  const { name, networkId, networkVisible } = req.body;
  const ownerId = req.user.id;
  const newId = new mongoose.Types.ObjectId().toString();
  const networkSettings = await resolveNetworkSettings(
    ownerId,
    networkId || null,
    networkVisible
  );
  if (networkSettings.error) {
    res.status(networkSettings.status);
    throw new Error(networkSettings.error);
  }

  const doc = await Document.create({
    _id: newId,
    owner: ownerId,
    name: name?.trim() || undefined,
    ...networkSettings,
  });

  await Users.findByIdAndUpdate(ownerId, { $push: { documents: newId } });
  res.status(201).json(doc);
});

const updateDocument = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, content, contentSegments, networkId, networkVisible } = req.body;
  const access = await getDocumentAccess(id, req.user.id);

  if (!access.allowed) {
    res.status(403);
    throw new Error("You do not have access to this document");
  }

  if (!canEdit(access.permission)) {
    res.status(403);
    throw new Error("You only have view access to this document");
  }

  const fallbackAuthor = {
    authorId: req.user.id,
    authorName: (await Users.findById(req.user.id).select("name").lean())?.name || "User",
  };

  const updates = {};
  if (name !== undefined) updates.name = name.trim();

  if (networkId !== undefined || networkVisible !== undefined) {
    const nextNetworkId =
      networkId !== undefined ? networkId || null : access.doc.networkId;
    const nextNetworkVisible =
      networkVisible !== undefined ? !!networkVisible : access.doc.networkVisible;
    const networkSettings = await resolveNetworkSettings(
      req.user.id,
      nextNetworkId,
      nextNetworkVisible
    );
    if (networkSettings.error) {
      res.status(networkSettings.status);
      throw new Error(networkSettings.error);
    }
    updates.networkId = networkSettings.networkId;
    updates.networkVisible = networkSettings.networkVisible;
  }

  if (contentSegments !== undefined) {
    const segments = normalizeSegments(contentSegments, fallbackAuthor);
    updates.contentSegments = segments;
    updates.content = segmentsToText(segments);
  } else if (content !== undefined) {
    updates.content = content;
    updates.contentSegments = [
      {
        authorId: fallbackAuthor.authorId,
        authorName: fallbackAuthor.authorName,
        color: getUserColor(fallbackAuthor.authorId),
        text: content,
      },
    ];
  }

  const doc = await Document.findByIdAndUpdate(id, updates, { new: true });
  if (!doc) {
    res.status(404);
    throw new Error("Document not found");
  }

  res.json(doc);
});

const deleteDocument = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const doc = await Document.findById(id);

  if (!doc) {
    res.status(404);
    throw new Error("Document not found");
  }

  if (!doc.owner || doc.owner.toString() !== req.user.id) {
    res.status(403);
    throw new Error("Only the document owner can delete this document");
  }

  await Document.findByIdAndDelete(id);
  await Users.findByIdAndUpdate(req.user.id, { $pull: { documents: id } });

  res.json({ message: "Document deleted" });
});

const requestShare = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { permission } = req.body;
  const userId = req.user.id;

  if (!["view", "edit"].includes(permission)) {
    res.status(400);
    throw new Error("Permission must be 'view' or 'edit'");
  }

  const doc = await Document.findById(id);
  if (!doc) {
    res.status(404);
    throw new Error("Document not found");
  }

  if (doc.owner && doc.owner.toString() === userId) {
    res.status(400);
    throw new Error("You already own this document");
  }

  if (!doc.networkVisible || !doc.networkId) {
    res.status(403);
    throw new Error("This document is private and not discoverable in any network");
  }

  const requesterInNetwork = await isNetworkMember(doc.networkId, userId);
  if (!requesterInNetwork) {
    res.status(403);
    throw new Error("You must be in the same network to request access to this document");
  }

  const alreadyShared = (doc.sharedWith || []).some(
    (entry) => entry.user && entry.user.toString() === userId
  );
  if (alreadyShared) {
    res.status(400);
    throw new Error("You already have access to this document");
  }

  const existingRequest = (doc.shareRequests || []).some(
    (entry) => entry.requester && entry.requester.toString() === userId
  );
  if (existingRequest) {
    res.status(400);
    throw new Error("You already have a pending request for this document");
  }

  await Document.findByIdAndUpdate(id, {
    $push: { shareRequests: { requester: userId, permission } },
  });

  res.status(201).json({ message: "Request sent" });
});

const getIncomingRequests = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (id !== req.user.id) {
    res.status(403);
    throw new Error("You can only view your own incoming requests");
  }

  const docs = await Document.find({ owner: id })
    .populate("shareRequests.requester", "name")
    .select("_id name shareRequests")
    .lean();

  const requests = [];
  docs.forEach((doc) => {
    doc.shareRequests.forEach((request) => {
      requests.push({
        documentId: doc._id,
        documentName: doc.name,
        requesterId: request.requester._id,
        requesterName: request.requester.name,
        permission: request.permission,
      });
    });
  });

  res.json(requests);
});

const getOutgoingRequests = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (id !== req.user.id) {
    res.status(403);
    throw new Error("You can only view your own outgoing requests");
  }

  const docs = await Document.find({ "shareRequests.requester": id })
    .populate("owner", "name")
    .select("_id name owner shareRequests")
    .lean();

  const requests = [];
  docs.forEach((doc) => {
    doc.shareRequests
      .filter((request) => request.requester.toString() === id)
      .forEach((request) => {
        requests.push({
          documentId: doc._id,
          documentName: doc.name,
          ownerId: doc.owner._id,
          ownerName: doc.owner.name,
          permission: request.permission,
        });
      });
  });

  res.json(requests);
});

const grantAccess = asyncHandler(async (req, res) => {
  const { id, requesterId } = req.params;
  const doc = await Document.findById(id);

  if (!doc) {
    res.status(404);
    throw new Error("Document not found");
  }

  if (!doc.owner || doc.owner.toString() !== req.user.id) {
    res.status(403);
    throw new Error("Only the document owner can grant access");
  }

  const requestEntry = doc.shareRequests.find(
    (request) => request.requester.toString() === requesterId
  );

  if (!requestEntry) {
    res.status(404);
    throw new Error("Request not found");
  }

  await Document.findByIdAndUpdate(id, {
    $push: {
      sharedWith: {
        user: requesterId,
        permission: requestEntry.permission,
        sharedAt: new Date(),
      },
    },
    $pull: { shareRequests: { requester: requesterId } },
  });

  res.json({ message: "Access granted" });
});

const removeRequest = asyncHandler(async (req, res) => {
  const { id, requesterId } = req.params;
  const doc = await Document.findById(id);

  if (!doc) {
    res.status(404);
    throw new Error("Document not found");
  }

  const isOwner = doc.owner && doc.owner.toString() === req.user.id;
  const isRequester = requesterId === req.user.id;

  if (!isOwner && !isRequester) {
    res.status(403);
    throw new Error("You cannot modify this request");
  }

  const updatedDoc = await Document.findByIdAndUpdate(
    id,
    { $pull: { shareRequests: { requester: requesterId } } },
    { new: true }
  );

  res.json({ message: "Request removed" });
});

const getUserProfile = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (id !== req.user.id) {
    res.status(403);
    throw new Error("You can only view your own profile");
  }

  const user = await Users.findById(id);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  await promoteAdminIfListed(user);

  const rawDocs = await Document.find({
    $or: [{ owner: user._id }, { "sharedWith.user": user._id }],
  })
    .populate("owner", "name")
    .populate("sharedWith.user", "name")
    .lean();

  const docs = rawDocs.map((doc) => {
    const isOwner = doc.owner && doc.owner._id.toString() === user._id.toString();
    const sharedEntry = (doc.sharedWith || []).find(
      (entry) => entry.user && entry.user._id.toString() === user._id.toString()
    );

    const sharedUsers = isOwner
      ? (doc.sharedWith || [])
          .filter((entry) => entry.user)
          .map((entry) => ({
            _id: entry.user._id,
            name: entry.user.name,
            permission: entry.permission || "view",
            sharedAt: entry.sharedAt,
          }))
      : [];

    return {
      _id: doc._id,
      name: doc.name,
      owner: doc.owner ? { _id: doc.owner._id, name: doc.owner.name } : null,
      permission: isOwner ? "edit" : sharedEntry?.permission || "view",
      sharedAt: sharedEntry ? sharedEntry.sharedAt : undefined,
      sharedUsers,
      networkId: doc.networkId || null,
      networkVisible: !!doc.networkVisible,
    };
  });

  res.json({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role || "user",
    documents: docs,
  });
});

const countWords = (content = "") => {
  const trimmed = content.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
};

const getDayIndex = (date, startDate) => {
  const diff = new Date(date).setHours(0, 0, 0, 0) - startDate.getTime();
  return Math.floor(diff / (24 * 60 * 60 * 1000));
};

const getUserAnalytics = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (id !== req.user.id) {
    res.status(403);
    throw new Error("You can only view your own analytics");
  }

  const userId = req.user.id;
  const networkIds = await getUserNetworkIds(userId);
  const userNetworks = networkIds.length
    ? await Network.find({ _id: { $in: networkIds } }).select("members").lean()
    : [];
  const networkMemberIds = new Set();
  userNetworks.forEach((network) => {
    (network.members || []).forEach((entry) => {
      if (entry.user && entry.user.toString() !== userId) {
        networkMemberIds.add(entry.user.toString());
      }
    });
  });

  const [ownedDocs, sharedDocs, discoverableDocs, outgoingDocs] = await Promise.all([
      Document.find({ owner: userId }).lean(),
      Document.find({ "sharedWith.user": userId }).populate("owner", "name").lean(),
      networkIds.length
        ? Document.countDocuments({
            owner: { $ne: userId },
            networkId: { $in: networkIds },
            networkVisible: true,
          })
        : Promise.resolve(0),
      Document.find({ "shareRequests.requester": userId })
        .select("shareRequests")
        .lean(),
    ]);

  const collaborators = networkMemberIds.size;

  const incomingRequests = ownedDocs.reduce(
    (total, doc) => total + (doc.shareRequests?.length || 0),
    0
  );

  const outgoingRequests = outgoingDocs.reduce((total, doc) => {
    const pending = (doc.shareRequests || []).filter(
      (request) => request.requester.toString() === userId
    );
    return total + pending.length;
  }, 0);

  const uniqueDocIds = new Set();
  let totalWords = 0;
  let totalCharacters = 0;

  [...ownedDocs, ...sharedDocs].forEach((doc) => {
    if (uniqueDocIds.has(doc._id)) return;
    uniqueDocIds.add(doc._id);

    const content = doc.content || "";
    totalCharacters += content.length;
    totalWords += countWords(content);
  });

  const editAccessCount = sharedDocs.filter((doc) => {
    const entry = (doc.sharedWith || []).find(
      (shared) => shared.user && shared.user.toString() === userId
    );
    return entry?.permission === "edit";
  }).length;

  const viewAccessCount = sharedDocs.length - editAccessCount;

  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - 6);

  const weeklyActivity = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + index);
    return {
      label: day.toLocaleDateString("en-US", { weekday: "short" }),
      count: 0,
    };
  });

  const bumpWeeklyActivity = (dateValue) => {
    if (!dateValue) return;
    const index = getDayIndex(dateValue, weekStart);
    if (index >= 0 && index < weeklyActivity.length) {
      weeklyActivity[index].count += 1;
    }
  };

  ownedDocs.forEach((doc) => {
    bumpWeeklyActivity(doc.createdAt || doc.updatedAt);
  });

  sharedDocs.forEach((doc) => {
    const entry = (doc.sharedWith || []).find(
      (shared) => shared.user && shared.user.toString() === userId
    );
    bumpWeeklyActivity(entry?.sharedAt);
  });

  const collaborationScore = Math.min(
    100,
    ownedDocs.length * 10 +
      sharedDocs.length * 14 +
      incomingRequests * 6 +
      collaborators * 4
  );

  const recentActivity = [
    ...ownedDocs.map((doc) => ({
      type: "created",
      title: doc.name || "Untitled Document",
      subtitle: "You created a document",
      date: doc.createdAt || doc.updatedAt,
    })),
    ...sharedDocs.map((doc) => {
      const entry = (doc.sharedWith || []).find(
        (shared) => shared.user && shared.user.toString() === userId
      );
      return {
        type: "shared",
        title: doc.name || "Untitled Document",
        subtitle: doc.owner ? `Shared by ${doc.owner.name}` : "Shared with you",
        date: entry?.sharedAt,
      };
    }),
  ]
    .filter((item) => item.date)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)
    .map((item) => ({
      ...item,
      date: new Date(item.date).toISOString(),
    }));

  res.json({
    ownedDocuments: ownedDocs.length,
    sharedWithYou: sharedDocs.length,
    incomingRequests,
    outgoingRequests,
    collaborators,
    networksJoined: networkIds.length,
    discoverableDocuments: discoverableDocs,
    totalWords,
    totalCharacters,
    editAccessCount,
    viewAccessCount,
    collaborationScore,
    weeklyActivity,
    recentActivity,
  });
});

module.exports = {
  getOrCreateDocument,
  createDocument,
  updateDocument,
  deleteDocument,
  requestShare,
  getIncomingRequests,
  getOutgoingRequests,
  grantAccess,
  removeRequest,
  getUserProfile,
  getUserAnalytics,
};
