
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const bodyParser = require("body-parser");
const cors = require("cors");
const signupHandler = require("./pathHandlers/signup.js");
const loginHandler = require("./pathHandlers/login.js");
const { connectDb, Document } = require("./utils/model");
const { getOrCreateDocument } = require("./pathHandlers/document");
const dotenv = require("dotenv").config();

const port = process.env.PORT || 5000;
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
connectDb();
//Returns middleware that only parses the json data
app.use(bodyParser.json());
// Returns middleware that only parses urlencoded bodies
app.use(bodyParser.urlencoded({ extended: true }));


app.use(cors({ origin: "*" }));
app.post("/signup", signupHandler);
app.post("/login", loginHandler);
app.get("/document/:id", getOrCreateDocument);

io.on("connection", (socket) => {
  socket.on("join-document", async (id) => {
    socket.join(id);
    const doc =
      (await Document.findById(id)) ||
      (await Document.create({ _id: id }));
    socket.emit("document", doc.content);

    socket.on("edit-document", async (content) => {
      await Document.findByIdAndUpdate(id, { content });
      socket.to(id).emit("document", content);
    });
  });
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
