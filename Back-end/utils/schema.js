
const mongoose = require("mongoose");

const userSchema = mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please enter a name"],
    unique: [true, "Name already taken"],
  },
  email: {
    type: String,
    required: [true, "Please enter a email"],
    unique: [true, "Email already exists"],
  },
  password: { type: String, required: true },
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "Users" }],
  documents: [{ type: String, ref: "Document" }],
});

const documentSchema = mongoose.Schema({
  _id: { type: String },
  name: { type: String, default: "Untitled" },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
  sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: "Users" }],
  content: { type: String, default: "" },
});

module.exports = { userSchema, documentSchema };
