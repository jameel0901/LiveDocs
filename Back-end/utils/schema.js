
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
});

const documentSchema = mongoose.Schema({
    _id: { type: String },
    content: { type: String, default: "" },
});

module.exports = { userSchema, documentSchema };
