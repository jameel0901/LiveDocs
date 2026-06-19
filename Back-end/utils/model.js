const {
  userSchema,
  networkSchema,
  documentSchema,
} = require("./schema");
const {
  liveChatIdentitySchema,
  liveChatConversationSchema,
  liveChatMessageSchema,
} = require("./liveChatSchema");
const mongoose = require("mongoose");
const { atlasUri } = require("../config/env");

const connectDb = async () => {
  try {
    const connection = await mongoose.connect(atlasUri);
    console.log(
      "Database connected:",
      connection.connection.host,
      connection.connection.name
    );
  } catch (err) {
    console.error("Database connection failed:", err.message);
    process.exit(1);
  }
};

const Users = mongoose.models.Users || mongoose.model("Users", userSchema);
const Network =
  mongoose.models.Network || mongoose.model("Network", networkSchema);
const Document =
  mongoose.models.Document || mongoose.model("Document", documentSchema);
const LiveChatIdentity =
  mongoose.models.LiveChatIdentity ||
  mongoose.model("LiveChatIdentity", liveChatIdentitySchema);
const LiveChatConversation =
  mongoose.models.LiveChatConversation ||
  mongoose.model("LiveChatConversation", liveChatConversationSchema);
const LiveChatMessage =
  mongoose.models.LiveChatMessage ||
  mongoose.model("LiveChatMessage", liveChatMessageSchema);

module.exports = {
  connectDb,
  Users,
  Network,
  Document,
  LiveChatIdentity,
  LiveChatConversation,
  LiveChatMessage,
};
