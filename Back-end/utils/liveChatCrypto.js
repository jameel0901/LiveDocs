const crypto = require("crypto");

const hashSha256 = (value) =>
  crypto.createHash("sha256").update(String(value)).digest("hex");

const hashAppUser = (userId, pepper) =>
  crypto.createHmac("sha256", pepper).update(String(userId)).digest("hex");

const hashRoom = (parts) =>
  hashSha256(parts.filter(Boolean).join(":"));

const directConversationId = (identityA, identityB) =>
  hashSha256([identityA, identityB].sort().join(":"));

const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString("hex");

const generateTurnCredentials = (secret, ttlSeconds = 86400) => {
  const expiry = Math.floor(Date.now() / 1000) + ttlSeconds;
  const username = `${expiry}:livechat`;
  const credential = crypto.createHmac("sha1", secret).update(username).digest("base64");
  return { username, credential, ttl: ttlSeconds };
};

module.exports = {
  hashSha256,
  hashAppUser,
  hashRoom,
  directConversationId,
  randomToken,
  generateTurnCredentials,
};
