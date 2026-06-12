const { Document } = require("./model");

const getDocumentAccess = async (documentId, userId) => {
  const doc = await Document.findById(documentId);
  if (!doc) {
    return { allowed: false, doc: null, permission: null };
  }

  if (doc.owner && doc.owner.toString() === userId) {
    return { allowed: true, doc, permission: "edit" };
  }

  const sharedEntry = (doc.sharedWith || []).find(
    (entry) => entry.user && entry.user.toString() === userId
  );

  if (sharedEntry) {
    return {
      allowed: true,
      doc,
      permission: sharedEntry.permission || "view",
    };
  }

  return { allowed: false, doc, permission: null };
};

const canView = (permission) => Boolean(permission);
const canEdit = (permission) => permission === "edit";

module.exports = { getDocumentAccess, canView, canEdit };
