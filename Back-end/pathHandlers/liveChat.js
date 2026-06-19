const asyncHandler = require("express-async-handler");
const {
  LiveChatIdentity,
  LiveChatConversation,
  LiveChatMessage,
} = require("../utils/model");
const {
  hashSha256,
  hashAppUser,
  randomToken,
  generateTurnCredentials,
  directConversationId,
} = require("../utils/liveChatCrypto");
const { jwtSecret, turnUrl, turnSecret, turnUrls } = require("../config/env");

const getAppUserHash = (userId) => hashAppUser(userId, jwtSecret);

const getMyIdentityHash = async (userId) => {
  const identity = await LiveChatIdentity.findOne({ appUserIdHash: getAppUserHash(userId) })
    .select("identityHash")
    .lean();
  return identity?.identityHash || null;
};

const registerIdentity = asyncHandler(async (req, res) => {
  const { publicKeyJwk, aliasHash, identityHash, displayAlias } = req.body;

  if (!publicKeyJwk || !aliasHash || !identityHash) {
    res.status(400);
    throw new Error("publicKeyJwk, aliasHash, and identityHash are required");
  }

  const alias = displayAlias?.trim() || "User";

  const appUserIdHash = getAppUserHash(req.user.id);
  const computedHash = hashSha256(JSON.stringify(publicKeyJwk));
  if (computedHash !== identityHash) {
    res.status(400);
    throw new Error("identityHash mismatch");
  }

  const identity = await LiveChatIdentity.findOneAndUpdate(
    { appUserIdHash },
    {
      identityHash,
      publicKeyJwk: JSON.stringify(publicKeyJwk),
      aliasHash,
      displayAlias: alias,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.json({
    identityHash: identity.identityHash,
    aliasHash: identity.aliasHash,
    displayAlias: identity.displayAlias || "User",
  });
});

const getMyIdentity = asyncHandler(async (req, res) => {
  const appUserIdHash = getAppUserHash(req.user.id);
  const identity = await LiveChatIdentity.findOne({ appUserIdHash })
    .select("identityHash publicKeyJwk aliasHash displayAlias -_id")
    .lean();

  if (!identity) {
    res.status(404);
    throw new Error("LiveChat identity not registered");
  }

  res.json({
    identityHash: identity.identityHash,
    publicKeyJwk: JSON.parse(identity.publicKeyJwk),
    aliasHash: identity.aliasHash,
    displayAlias: identity.displayAlias || "User",
  });
});

const listUsers = asyncHandler(async (req, res) => {
  const myHash = await getMyIdentityHash(req.user.id);
  if (!myHash) {
    res.status(404);
    throw new Error("LiveChat identity not registered");
  }

  const users = await LiveChatIdentity.find({ identityHash: { $ne: myHash } })
    .select("identityHash displayAlias publicKeyJwk -_id")
    .sort({ displayAlias: 1 })
    .lean();

  res.json(
    users.map((user) => ({
      identityHash: user.identityHash,
      displayAlias: user.displayAlias || "User",
      publicKeyJwk: JSON.parse(user.publicKeyJwk),
    }))
  );
});

const lookupIdentity = asyncHandler(async (req, res) => {
  const { identityHash } = req.params;
  const identity = await LiveChatIdentity.findOne({ identityHash })
    .select("identityHash publicKeyJwk aliasHash displayAlias -_id")
    .lean();

  if (!identity) {
    res.status(404);
    throw new Error("Identity not found");
  }

  res.json({
    identityHash: identity.identityHash,
    publicKeyJwk: JSON.parse(identity.publicKeyJwk),
    aliasHash: identity.aliasHash,
    displayAlias: identity.displayAlias || "User",
  });
});

const listConversations = asyncHandler(async (req, res) => {
  const myHash = await getMyIdentityHash(req.user.id);
  if (!myHash) {
    res.status(404);
    throw new Error("LiveChat identity not registered");
  }

  const conversations = await LiveChatConversation.find({ participants: myHash })
    .sort({ lastMessageAt: -1 })
    .lean();

  res.json(conversations);
});

const createDirectConversation = asyncHandler(async (req, res) => {
  const { targetIdentityHash } = req.body;
  const myHash = await getMyIdentityHash(req.user.id);

  if (!myHash || !targetIdentityHash) {
    res.status(400);
    throw new Error("targetIdentityHash is required");
  }

  if (myHash === targetIdentityHash) {
    res.status(400);
    throw new Error("Cannot message yourself");
  }

  const target = await LiveChatIdentity.findOne({ identityHash: targetIdentityHash }).lean();
  if (!target) {
    res.status(404);
    throw new Error("User not found");
  }

  const conversationId = directConversationId(myHash, targetIdentityHash);
  const conversation = await LiveChatConversation.findOneAndUpdate(
    { conversationId },
    {
      conversationId,
      type: "direct",
      name: target.displayAlias || "User",
      participants: [myHash, targetIdentityHash].sort(),
      createdBy: myHash,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.status(201).json(conversation);
});

const createGroupConversation = asyncHandler(async (req, res) => {
  const { name, participantIdentityHashes, groupKeyEnvelopes } = req.body;
  const myHash = await getMyIdentityHash(req.user.id);

  if (!myHash || !name?.trim() || !Array.isArray(participantIdentityHashes)) {
    res.status(400);
    throw new Error("name and participantIdentityHashes are required");
  }

  const participants = Array.from(new Set([myHash, ...participantIdentityHashes])).sort();
  if (participants.length < 2) {
    res.status(400);
    throw new Error("A group needs at least two members");
  }

  const conversationId = randomToken(16);
  const conversation = await LiveChatConversation.create({
    conversationId,
    type: "group",
    name: name.trim(),
    participants,
    createdBy: myHash,
    groupKeyEnvelopes: groupKeyEnvelopes || [],
    lastMessageAt: new Date(),
  });

  res.status(201).json(conversation);
});

const getConversationMessages = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const myHash = await getMyIdentityHash(req.user.id);
  const conversation = await LiveChatConversation.findOne({ conversationId }).lean();

  if (!conversation || !conversation.participants.includes(myHash)) {
    res.status(403);
    throw new Error("Access denied");
  }

  const messages = await LiveChatMessage.find({ conversationId })
    .sort({ createdAt: 1 })
    .select("messageId senderIdentityHash ciphertext nonce payloadType createdAt -_id")
    .lean();

  res.json(messages);
});

const getTurnCredentials = asyncHandler(async (req, res) => {
  if (!turnSecret || !turnUrl) {
    res.json({
      urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"],
      username: "",
      credential: "",
      ttl: 3600,
      iceTransportPolicy: "all",
      turnAvailable: false,
    });
    return;
  }

  const creds = generateTurnCredentials(turnSecret, 3600);
  res.json({
    urls: turnUrls.length > 0 ? turnUrls : [turnUrl],
    username: creds.username,
    credential: creds.credential,
    ttl: creds.ttl,
    iceTransportPolicy: "relay",
    turnAvailable: true,
  });
});

module.exports = {
  registerIdentity,
  getMyIdentity,
  listUsers,
  lookupIdentity,
  listConversations,
  createDirectConversation,
  createGroupConversation,
  getConversationMessages,
  getTurnCredentials,
  getMyIdentityHash,
};
