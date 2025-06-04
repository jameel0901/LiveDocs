const { Document } = require("../utils/model");
const asyncHandler = require("express-async-handler");

const getOrCreateDocument = asyncHandler(async (req, res) => {
  const { id } = req.params;
  let doc = await Document.findById(id);
  if (!doc) {
    doc = await Document.create({ _id: id });
  }
  res.json(doc);
});

module.exports = { getOrCreateDocument };
