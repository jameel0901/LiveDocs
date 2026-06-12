const asyncHandler = require("express-async-handler");
const bcrypt = require("bcrypt");
const { Users, Document, Network } = require("../utils/model");

const countWords = (content = "") => {
  const trimmed = content.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
};

const buildUserAnalytics = (userId, ownedDocs, sharedDocs, networkCount) => {
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

  const incomingRequests = ownedDocs.reduce(
    (total, doc) => total + (doc.shareRequests?.length || 0),
    0
  );

  const networkVisibleCount = ownedDocs.filter((doc) => doc.networkVisible).length;

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

  const bump = (dateValue) => {
    if (!dateValue) return;
    const diff =
      new Date(dateValue).setHours(0, 0, 0, 0) - weekStart.getTime();
    const index = Math.floor(diff / (24 * 60 * 60 * 1000));
    if (index >= 0 && index < weeklyActivity.length) {
      weeklyActivity[index].count += 1;
    }
  };

  ownedDocs.forEach((doc) => bump(doc.createdAt || doc.updatedAt));
  sharedDocs.forEach((doc) => {
    const entry = (doc.sharedWith || []).find(
      (shared) => shared.user && shared.user.toString() === userId
    );
    bump(entry?.sharedAt);
  });

  const collaborationScore = Math.min(
    100,
    ownedDocs.length * 10 +
      sharedDocs.length * 14 +
      incomingRequests * 6 +
      networkCount * 4
  );

  return {
    ownedDocuments: ownedDocs.length,
    sharedWithYou: sharedDocs.length,
    incomingRequests,
    networkVisibleDocuments: networkVisibleCount,
    networksJoined: networkCount,
    totalWords,
    totalCharacters,
    collaborationScore,
    weeklyActivity,
  };
};

const getAdminOverview = asyncHandler(async (req, res) => {
  const [userCount, documentCount, networkCount, activeToday] = await Promise.all([
    Users.countDocuments(),
    Document.countDocuments(),
    Network.countDocuments(),
    Users.countDocuments({
      updatedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    }),
  ]);

  const networkVisibleDocs = await Document.countDocuments({ networkVisible: true });
  const sharedDocs = await Document.countDocuments({
    "sharedWith.0": { $exists: true },
  });

  res.json({
    totalUsers: userCount,
    totalDocuments: documentCount,
    totalNetworks: networkCount,
    networkVisibleDocuments: networkVisibleDocs,
    sharedDocuments: sharedDocs,
    activeUsers24h: activeToday,
  });
});

const listAdminUsers = asyncHandler(async (req, res) => {
  const users = await Users.find()
    .select("name email role createdAt updatedAt networks documents")
    .sort({ createdAt: -1 })
    .lean();

  const results = await Promise.all(
    users.map(async (user) => {
      const [ownedDocs, sharedDocs, networkCount] = await Promise.all([
        Document.find({ owner: user._id }).lean(),
        Document.find({ "sharedWith.user": user._id }).lean(),
        Network.countDocuments({ "members.user": user._id }),
      ]);

      const analytics = buildUserAnalytics(
        user._id.toString(),
        ownedDocs,
        sharedDocs,
        networkCount
      );

      const userNetworks = await Network.find({ "members.user": user._id })
        .select("name joinCode members")
        .lean();

      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role || "user",
        passwordStatus: "encrypted",
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        networks: userNetworks.map((network) => ({
          _id: network._id,
          name: network.name,
          joinCode: network.joinCode,
          memberCount: network.members?.length || 0,
        })),
        documents: ownedDocs.map((doc) => ({
          _id: doc._id,
          name: doc.name,
          networkVisible: !!doc.networkVisible,
          networkId: doc.networkId || null,
          sharedCount: doc.sharedWith?.length || 0,
          wordCount: countWords(doc.content),
          updatedAt: doc.updatedAt,
        })),
        analytics,
      };
    })
  );

  res.json(results);
});

const getAdminUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = await Users.findById(id)
    .select("name email role createdAt updatedAt networks documents")
    .lean();

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  const [ownedDocs, sharedDocs, networks, networkCount] = await Promise.all([
    Document.find({ owner: user._id }).lean(),
    Document.find({ "sharedWith.user": user._id }).populate("owner", "name").lean(),
    Network.find({ "members.user": user._id }).select("name description joinCode").lean(),
    Network.countDocuments({ "members.user": user._id }),
  ]);

  const analytics = buildUserAnalytics(
    user._id.toString(),
    ownedDocs,
    sharedDocs,
    networkCount
  );

  const recentActivity = [
    ...ownedDocs.map((doc) => ({
      type: "created",
      title: doc.name || "Untitled Document",
      subtitle: "Created a document",
      date: doc.createdAt || doc.updatedAt,
    })),
    ...sharedDocs.map((doc) => {
      const entry = (doc.sharedWith || []).find(
        (shared) => shared.user && shared.user.toString() === user._id.toString()
      );
      return {
        type: "shared",
        title: doc.name || "Untitled Document",
        subtitle: doc.owner ? `Shared by ${doc.owner.name}` : "Shared with user",
        date: entry?.sharedAt,
      };
    }),
  ]
    .filter((item) => item.date)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8)
    .map((item) => ({
      ...item,
      date: new Date(item.date).toISOString(),
    }));

  res.json({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role || "user",
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    networks: networks.map((network) => ({
      _id: network._id,
      name: network.name,
      description: network.description,
      joinCode: network.joinCode,
    })),
    ownedDocuments: ownedDocs.map((doc) => ({
      _id: doc._id,
      name: doc.name,
      networkVisible: !!doc.networkVisible,
      networkId: doc.networkId || null,
      sharedCount: doc.sharedWith?.length || 0,
      requestCount: doc.shareRequests?.length || 0,
      wordCount: countWords(doc.content),
      characterCount: (doc.content || "").length,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    })),
    sharedDocuments: sharedDocs.map((doc) => {
      const entry = (doc.sharedWith || []).find(
        (shared) => shared.user && shared.user.toString() === user._id.toString()
      );
      return {
        _id: doc._id,
        name: doc.name,
        owner: doc.owner ? { _id: doc.owner._id, name: doc.owner.name } : null,
        permission: entry?.permission || "view",
        sharedAt: entry?.sharedAt,
      };
    }),
    analytics: { ...analytics, recentActivity },
  });
});

const listAdminNetworks = asyncHandler(async (req, res) => {
  const networks = await Network.find()
    .populate("createdBy", "name email")
    .sort({ updatedAt: -1 })
    .lean();

  const results = await Promise.all(
    networks.map(async (network) => {
      const memberCount = network.members?.length || 0;
      const visibleDocs = await Document.countDocuments({
        networkId: network._id,
        networkVisible: true,
      });

      return {
        _id: network._id,
        name: network.name,
        description: network.description,
        joinCode: network.joinCode,
        memberCount,
        visibleDocuments: visibleDocs,
        createdBy: network.createdBy
          ? {
              _id: network.createdBy._id,
              name: network.createdBy.name,
              email: network.createdBy.email,
            }
          : null,
        createdAt: network.createdAt,
      };
    })
  );

  res.json(results);
});

const updateAdminUserPassword = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (!password || password.length < 6) {
    res.status(400);
    throw new Error("Password must be at least 6 characters");
  }

  const user = await Users.findById(id).select("+password");
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  user.password = await bcrypt.hash(password, 10);
  await user.save();

  res.json({ message: "Password updated" });
});

const cleanupOrphanedNetworks = async () => {
  const orphanedNetworks = await Network.find({
    $or: [{ members: { $size: 0 } }, { members: { $exists: false } }],
  }).select("_id");

  for (const network of orphanedNetworks) {
    await Document.updateMany(
      { networkId: network._id },
      { networkId: null, networkVisible: false }
    );
    await Users.updateMany({ networks: network._id }, { $pull: { networks: network._id } });
    await Network.findByIdAndDelete(network._id);
  }
};

const deleteAdminUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (id === req.user.id) {
    res.status(403);
    throw new Error("You cannot delete your own admin account");
  }

  const user = await Users.findById(id);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  const ownedDocIds = await Document.find({ owner: id }).distinct("_id");

  await Document.deleteMany({ owner: id });
  await Document.updateMany(
    { "sharedWith.user": id },
    { $pull: { sharedWith: { user: id } } }
  );
  await Document.updateMany(
    { "shareRequests.requester": id },
    { $pull: { shareRequests: { requester: id } } }
  );

  if (ownedDocIds.length > 0) {
    await Users.updateMany({}, { $pull: { documents: { $in: ownedDocIds } } });
  }

  await Network.updateMany(
    { "members.user": id },
    { $pull: { members: { user: id } } }
  );
  await cleanupOrphanedNetworks();
  await Users.findByIdAndDelete(id);

  res.json({ message: "User deleted" });
});

const deleteAdminDocument = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const doc = await Document.findById(id);

  if (!doc) {
    res.status(404);
    throw new Error("Document not found");
  }

  await Document.findByIdAndDelete(id);

  if (doc.owner) {
    await Users.findByIdAndUpdate(doc.owner, { $pull: { documents: id } });
  }

  res.json({ message: "Document deleted" });
});

const deleteAdminNetwork = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const network = await Network.findById(id);

  if (!network) {
    res.status(404);
    throw new Error("Network not found");
  }

  await Document.updateMany(
    { networkId: id },
    { networkId: null, networkVisible: false }
  );
  await Users.updateMany({ networks: id }, { $pull: { networks: id } });
  await Network.findByIdAndDelete(id);

  res.json({ message: "Network deleted" });
});

module.exports = {
  getAdminOverview,
  listAdminUsers,
  getAdminUser,
  listAdminNetworks,
  updateAdminUserPassword,
  deleteAdminUser,
  deleteAdminDocument,
  deleteAdminNetwork,
};
