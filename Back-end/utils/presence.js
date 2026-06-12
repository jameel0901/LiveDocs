const presenceByDocument = new Map();
const presenceSubscribers = new Map();

const getDocumentPresence = (documentId) => {
  if (!presenceByDocument.has(documentId)) {
    presenceByDocument.set(documentId, new Map());
  }
  return presenceByDocument.get(documentId);
};

const addSocketToDocument = (documentId, socket) => {
  const room = getDocumentPresence(documentId);
  const userId = socket.data.userId;

  if (!room.has(userId)) {
    room.set(userId, {
      userId,
      userName: socket.data.userName || "User",
      socketIds: new Set(),
      isTyping: false,
    });
  }

  room.get(userId).socketIds.add(socket.id);
  room.get(userId).userName = socket.data.userName || room.get(userId).userName;
};

const removeSocketFromDocument = (documentId, socket) => {
  const room = presenceByDocument.get(documentId);
  if (!room) return false;

  const userId = socket.data.userId;
  const entry = room.get(userId);
  if (!entry) return false;

  entry.socketIds.delete(socket.id);

  if (entry.socketIds.size === 0) {
    room.delete(userId);
  }

  if (room.size === 0) {
    presenceByDocument.delete(documentId);
  }

  return true;
};

const setUserTyping = (documentId, userId, isTyping) => {
  const room = presenceByDocument.get(documentId);
  if (!room) return;

  const entry = room.get(userId);
  if (entry) {
    entry.isTyping = isTyping;
  }
};

const getPresenceList = (documentId) => {
  const room = presenceByDocument.get(documentId);
  if (!room) return [];

  return Array.from(room.values()).map((entry) => ({
    userId: entry.userId,
    userName: entry.userName,
    isTyping: entry.isTyping,
    isActive: true,
  }));
};

const subscribePresence = (userId, socketId) => {
  if (!presenceSubscribers.has(userId)) {
    presenceSubscribers.set(userId, new Set());
  }
  presenceSubscribers.get(userId).add(socketId);
};

const unsubscribePresence = (userId, socketId) => {
  const subscribers = presenceSubscribers.get(userId);
  if (!subscribers) return;

  subscribers.delete(socketId);
  if (subscribers.size === 0) {
    presenceSubscribers.delete(userId);
  }
};

const getPresenceSubscribers = (userId) =>
  Array.from(presenceSubscribers.get(userId) || []);

const buildPresenceSnapshot = (documentIds = []) => {
  const snapshot = {};

  documentIds.forEach((documentId) => {
    const users = getPresenceList(documentId);
    if (users.length > 0) {
      snapshot[documentId] = users;
    }
  });

  return snapshot;
};

const removeSocketFromAllDocuments = (socket) => {
  const affectedDocuments = [];

  presenceByDocument.forEach((room, documentId) => {
    if (room.has(socket.data.userId) && room.get(socket.data.userId).socketIds.has(socket.id)) {
      removeSocketFromDocument(documentId, socket);
      affectedDocuments.push(documentId);
    }
  });

  return affectedDocuments;
};

module.exports = {
  addSocketToDocument,
  removeSocketFromDocument,
  removeSocketFromAllDocuments,
  setUserTyping,
  getPresenceList,
  subscribePresence,
  unsubscribePresence,
  getPresenceSubscribers,
  buildPresenceSnapshot,
};
