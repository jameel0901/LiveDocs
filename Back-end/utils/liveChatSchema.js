const mongoose = require("mongoose");

const liveChatIdentitySchema = mongoose.Schema(
  {
    identityHash: { type: String, required: true, unique: true, index: true },
    displayAlias: { type: String, required: true, trim: true, index: true },
    publicKeyJwk: { type: String, required: true },
    aliasHash: { type: String, required: true },
    appUserIdHash: { type: String, required: true, unique: true, index: true },
  },
  { timestamps: true, versionKey: false }
);

const liveChatConversationSchema = mongoose.Schema(
  {
    conversationId: { type: String, required: true, unique: true, index: true },
    type: { type: String, enum: ["direct", "group"], required: true },
    name: { type: String, trim: true, default: "" },
    participants: [{ type: String, index: true }],
    createdBy: { type: String, required: true },
    groupKeyEnvelopes: [
      {
        identityHash: String,
        ciphertext: String,
        nonce: String,
      },
    ],
    lastMessageAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true, versionKey: false }
);

liveChatConversationSchema.index({ participants: 1, lastMessageAt: -1 });

const liveChatMessageSchema = mongoose.Schema(
  {
    messageId: { type: String, required: true, unique: true, index: true },
    conversationId: { type: String, required: true, index: true },
    senderIdentityHash: { type: String, required: true, index: true },
    ciphertext: { type: String, required: true },
    nonce: { type: String, required: true },
    payloadType: {
      type: String,
      enum: ["text", "file"],
      default: "text",
    },
  },
  { timestamps: true, versionKey: false }
);

liveChatMessageSchema.index({ conversationId: 1, createdAt: 1 });

module.exports = {
  liveChatIdentitySchema,
  liveChatConversationSchema,
  liveChatMessageSchema,
};
