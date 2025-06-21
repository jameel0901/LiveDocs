const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const bodyParser = require("body-parser");
const cors = require("cors");
const signupHandler = require("./pathHandlers/signup.js");
const loginHandler = require("./pathHandlers/login.js");
const { connectDb, Document, Users } = require("./utils/model");

const {
  getOrCreateDocument,
  createDocument,
  updateDocument,
  requestShare,
  getIncomingRequests,
  getOutgoingRequests,
  grantAccess,
  removeRequest,
} = require("./pathHandlers/document");

const path = require("path");
const envPath = path.join(__dirname, ".env");
const result = require("dotenv").config({ path: envPath });
if (result.error) {
  console.warn(`Failed to load environment variables from ${envPath}`);
}

const port = process.env.PORT || 5000;
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "https://jameel0901.github.io" } });
connectDb();
//Returns middleware that only parses the json data
app.use(bodyParser.json());
// Returns middleware that only parses urlencoded bodies
app.use(bodyParser.urlencoded({ extended: true }));


app.use(cors({ origin: "https://jameel0901.github.io" }));
app.post("/signup", signupHandler);
app.post("/login", loginHandler);
app.get("/document/:id", getOrCreateDocument);
app.post("/documents", createDocument);
app.put("/documents/:id", updateDocument);
app.post("/documents/:id/request", requestShare);
app.post("/documents/:id/requests/:requesterId/grant", grantAccess);
app.delete("/documents/:id/requests/:requesterId", removeRequest);
app.get("/users/:id/incoming-requests", getIncomingRequests);
app.get("/users/:id/outgoing-requests", getOutgoingRequests);
app.get("/users", async (req, res) => {
  const users = await Users.find().lean();
  const populated = await Promise.all(
    users.map(async (u) => {
      const docs = await Document.find({ owner: u._id }).select("_id name").lean();
      return { _id: u._id, name: u.name, documents: docs };
    })
  );
  res.json(populated);
});

app.get("/users/:id", async (req, res) => {
  const user = await Users.findById(req.params.id).lean();
  if (!user) return res.status(404).send("User not found");
  const rawDocs = await Document.find({
    $or: [{ owner: user._id }, { 'sharedWith.user': user._id }],
  })
    .populate('owner', 'name')
    .lean();

  const docs = rawDocs.map((d) => {

    const info = (d.sharedWith || []).find(
      (sw) => sw.user && sw.user.toString() === user._id.toString()

    );
    return {
      _id: d._id,
      name: d.name,
      owner: d.owner ? { _id: d.owner._id, name: d.owner.name } : null,
      sharedAt: info ? info.sharedAt : undefined,
    };
  });

  res.json({ ...user, documents: docs });
});

io.on("connection", (socket) => {
  socket.on("join-document", async (id) => {
    socket.join(id);
    const doc =
      (await Document.findById(id)) ||
      (await Document.create({ _id: id }));
    socket.emit("document", { content: doc.content, authors: doc.authors || [] });

    socket.on("edit-document", async (op) => {
      const doc =
        (await Document.findById(id)) || (await Document.create({ _id: id }));
      const current = doc.content || "";
      const newContent =
        current.slice(0, op.index) +
        op.insertText +
        current.slice(op.index + op.deleteCount);
      doc.content = newContent;
      const authorInsert = Array(op.insertText.length).fill(op.userId);
      if (!Array.isArray(doc.authors)) doc.authors = [];
      doc.authors.splice(op.index, op.deleteCount, ...authorInsert);
      await doc.save();
      socket.to(id).emit("document-op", op);
    });
  });
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
