const crypto = require("crypto");
const asyncHandler = require("express-async-handler");
const { Network, Users, Document } = require("../utils/model");
const { isNetworkMember } = require("../utils/networkAccess");

const generateJoinCode = () => crypto.randomBytes(4).toString("hex").toUpperCase();

const createNetwork = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  const userId = req.user.id;

  if (!name?.trim()) {
    res.status(400);
    throw new Error("Network name is required");
  }

  let joinCode = generateJoinCode();
  let attempts = 0;
  while (attempts < 5) {
    const existing = await Network.findOne({ joinCode }).select("_id").lean();
    if (!existing) break;
    joinCode = generateJoinCode();
    attempts += 1;
  }

  const network = await Network.create({
    name: name.trim(),
    description: description?.trim() || "",
    createdBy: userId,
    joinCode,
    members: [{ user: userId, joinedAt: new Date() }],
  });

  await Users.findByIdAndUpdate(userId, { $addToSet: { networks: network._id } });

  res.status(201).json({
    _id: network._id,
    name: network.name,
    description: network.description,
    joinCode: network.joinCode,
    memberCount: 1,
    createdAt: network.createdAt,
  });
});

const listNetworks = asyncHandler(async (req, res) => {
  const networks = await Network.find({ "members.user": req.user.id })
    .select("name description joinCode members createdAt")
    .sort({ updatedAt: -1 })
    .lean();

  res.json(
    networks.map((network) => ({
      _id: network._id,
      name: network.name,
      description: network.description,
      joinCode: network.joinCode,
      memberCount: network.members?.length || 0,
      createdAt: network.createdAt,
    }))
  );
});

const getNetwork = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const isMember = await isNetworkMember(id, req.user.id);

  if (!isMember) {
    res.status(403);
    throw new Error("You are not a member of this network");
  }

  const network = await Network.findById(id)
    .populate("members.user", "name email")
    .populate("createdBy", "name")
    .lean();

  if (!network) {
    res.status(404);
    throw new Error("Network not found");
  }

  res.json({
    _id: network._id,
    name: network.name,
    description: network.description,
    joinCode: network.joinCode,
    createdBy: network.createdBy
      ? { _id: network.createdBy._id, name: network.createdBy.name }
      : null,
    members: (network.members || [])
      .filter((entry) => entry.user)
      .map((entry) => ({
        _id: entry.user._id,
        name: entry.user.name,
        email: entry.user.email,
        joinedAt: entry.joinedAt,
      })),
    createdAt: network.createdAt,
  });
});

const joinNetwork = asyncHandler(async (req, res) => {
  const { joinCode } = req.body;
  const userId = req.user.id;

  if (!joinCode?.trim()) {
    res.status(400);
    throw new Error("Join code is required");
  }

  const network = await Network.findOne({
    joinCode: joinCode.trim().toUpperCase(),
  });

  if (!network) {
    res.status(404);
    throw new Error("Network not found. Check the join code.");
  }

  const alreadyMember = (network.members || []).some(
    (entry) => entry.user && entry.user.toString() === userId
  );

  if (alreadyMember) {
    res.status(400);
    throw new Error("You are already a member of this network");
  }

  network.members.push({ user: userId, joinedAt: new Date() });
  await network.save();
  await Users.findByIdAndUpdate(userId, { $addToSet: { networks: network._id } });

  res.json({
    _id: network._id,
    name: network.name,
    description: network.description,
    joinCode: network.joinCode,
    memberCount: network.members.length,
  });
});

const leaveNetwork = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const network = await Network.findById(id);
  if (!network) {
    res.status(404);
    throw new Error("Network not found");
  }

  const isMember = (network.members || []).some(
    (entry) => entry.user && entry.user.toString() === userId
  );

  if (!isMember) {
    res.status(403);
    throw new Error("You are not a member of this network");
  }

  network.members = network.members.filter(
    (entry) => !entry.user || entry.user.toString() !== userId
  );

  if (network.members.length === 0) {
    await Document.updateMany({ networkId: id }, { networkId: null, networkVisible: false });
    await Network.findByIdAndDelete(id);
    await Users.updateMany({ networks: id }, { $pull: { networks: id } });
    return res.json({ message: "Network deleted because it had no members" });
  }

  await network.save();
  await Users.findByIdAndUpdate(userId, { $pull: { networks: id } });
  await Document.updateMany(
    { owner: userId, networkId: id },
    { networkId: null, networkVisible: false }
  );

  res.json({ message: "Left network" });
});

const getNetworkFeed = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const isMember = await isNetworkMember(id, req.user.id);

  if (!isMember) {
    res.status(403);
    throw new Error("You are not a member of this network");
  }

  const network = await Network.findById(id)
    .populate("members.user", "name email")
    .lean();

  if (!network) {
    res.status(404);
    throw new Error("Network not found");
  }

  const memberIds = (network.members || [])
    .map((entry) => entry.user?._id)
    .filter(Boolean);

  const visibleDocs = await Document.find({
    owner: { $in: memberIds, $ne: req.user.id },
    networkId: id,
    networkVisible: true,
  })
    .populate("owner", "name")
    .select("_id name owner networkVisible updatedAt")
    .lean();

  const members = (network.members || [])
    .filter((entry) => entry.user)
    .map((entry) => {
      const memberDocs = visibleDocs.filter(
        (doc) => doc.owner && doc.owner._id.toString() === entry.user._id.toString()
      );

      return {
        _id: entry.user._id,
        name: entry.user.name,
        email: entry.user.email,
        documents: memberDocs.map((doc) => ({
          _id: doc._id,
          name: doc.name,
          updatedAt: doc.updatedAt,
        })),
      };
    })
    .filter((member) => member._id.toString() !== req.user.id);

  res.json({
    network: {
      _id: network._id,
      name: network.name,
      description: network.description,
    },
    members,
    visibleDocumentCount: visibleDocs.length,
  });
});

module.exports = {
  createNetwork,
  listNetworks,
  getNetwork,
  joinNetwork,
  leaveNetwork,
  getNetworkFeed,
};
