const mongoose = require("mongoose");

const userSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please enter a name"],
      unique: [true, "Name already taken"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Please enter an email"],
      unique: [true, "Email already exists"],
      trim: true,
      lowercase: true,
    },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    networks: [{ type: mongoose.Schema.Types.ObjectId, ref: "Network" }],
    documents: [{ type: String, ref: "Document" }],
  },
  { timestamps: true }
);

const networkSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Network name is required"],
      trim: true,
    },
    description: { type: String, trim: true, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
    members: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
    joinCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
  },
  { timestamps: true }
);

const documentSchema = mongoose.Schema(
  {
    _id: { type: String },
    name: { type: String, default: "Untitled", trim: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
    networkId: { type: mongoose.Schema.Types.ObjectId, ref: "Network", default: null },
    networkVisible: { type: Boolean, default: false },
    sharedWith: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
        permission: {
          type: String,
          enum: ["view", "edit"],
          default: "view",
        },
        sharedAt: { type: Date, default: Date.now },
      },
    ],
    shareRequests: [
      {
        requester: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
        permission: { type: String, enum: ["view", "edit"], default: "view" },
      },
    ],
    content: { type: String, default: "" },
    contentSegments: [
      {
        authorId: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
        authorName: { type: String },
        color: { type: String },
        text: { type: String },
      },
    ],
  },
  { timestamps: true }
);

module.exports = { userSchema, networkSchema, documentSchema };
