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

const requestShare = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId, permission } = req.body;
  const doc = await Document.findByIdAndUpdate(
    id,
    {
      $push: {
        shareRequests: { requester: userId, permission },
      },
    },
    { new: true }
  );
  if (!doc) return res.status(404).send("Document not found");
  res.json({ message: "Request sent" });
});

const getIncomingRequests = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const docs = await Document.find({ owner: id })
    .populate("shareRequests.requester", "name")
    .select("_id name shareRequests")
    .lean();
  const requests = [];
  docs.forEach((doc) => {
    doc.shareRequests.forEach((r) => {
      requests.push({
        documentId: doc._id,
        documentName: doc.name,
        requesterId: r.requester._id,
        requesterName: r.requester.name,
        permission: r.permission,
      });
    });
  });
  res.json(requests);
});

const getOutgoingRequests = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const docs = await Document.find({ "shareRequests.requester": id })
    .populate("owner", "name")
    .select("_id name owner shareRequests")
    .lean();
  const requests = [];
  docs.forEach((doc) => {
    doc.shareRequests
      .filter((r) => r.requester.toString() === id)
      .forEach((r) => {
        requests.push({
          documentId: doc._id,
          documentName: doc.name,
          ownerId: doc.owner._id,
          ownerName: doc.owner.name,
          permission: r.permission,
        });
      });
  });
  res.json(requests);
});

const grantAccess = asyncHandler(async (req, res) => {
  const { id, requesterId } = req.params;
  const doc = await Document.findById(id);
  if (!doc) return res.status(404).send("Document not found");
  const reqIndex = doc.shareRequests.findIndex(
    (r) => r.requester.toString() === requesterId
  );
  if (reqIndex === -1)
    return res.status(404).send("Request not found");

  await Document.findByIdAndUpdate(id, {
    $push: { sharedWith: requesterId },
    $pull: { shareRequests: { requester: requesterId } },
  });

  res.json({ message: "Access granted" });
});

const removeRequest = asyncHandler(async (req, res) => {
  const { id, requesterId } = req.params;
  const doc = await Document.findByIdAndUpdate(
    id,
    { $pull: { shareRequests: { requester: requesterId } } },
    { new: true }
  );
  if (!doc) return res.status(404).send("Document not found");
  res.json({ message: "Request removed" });
});

module.exports = {
  getOrCreateDocument,
  createDocument,
  updateDocument,
  requestShare,
  getIncomingRequests,
  getOutgoingRequests,
  grantAccess,
  removeRequest,
};


