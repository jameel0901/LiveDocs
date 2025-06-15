const { Document, Users } = require("../utils/model");
const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");

const getOrCreateDocument = asyncHandler(async (req, res) => {
  const { id } = req.params;
  let doc = await Document.findById(id);
  if (!doc) {
    doc = await Document.create({ _id: id });
  }
  res.json(doc);
});

const createDocument = asyncHandler(async (req, res) => {
  const { ownerId, name } = req.body;
  const newId = new mongoose.Types.ObjectId().toString();
  const doc = await Document.create({ _id: newId, owner: ownerId, name });
  if (ownerId) {
    await Users.findByIdAndUpdate(ownerId, { $push: { documents: newId } });
  }
  res.status(201).json(doc);
});

const updateDocument = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, content } = req.body;
  const doc = await Document.findByIdAndUpdate(
    id,
    { ...(name && { name }), ...(content && { content }) },
    { new: true }
  );
  if (!doc) return res.status(404).send("Document not found");
  res.json(doc);
});

module.exports = { getOrCreateDocument, createDocument, updateDocument };
