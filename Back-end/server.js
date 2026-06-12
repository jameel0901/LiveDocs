const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const bodyParser = require("body-parser");
const cors = require("cors");

require("./config/env");

const { port, corsOrigin } = require("./config/env");
const { connectDb } = require("./utils/model");
const { seedAdminUsers } = require("./utils/seedAdmin");
const { verifyToken } = require("./utils/token");
const { authenticate } = require("./middleware/auth");
const { requireAdmin } = require("./middleware/admin");
const errorHandler = require("./middleware/errorHandler");
const { registerDocumentSockets } = require("./socket/documentSocket");

const signupHandler = require("./pathHandlers/signup");
const loginHandler = require("./pathHandlers/login");
const { updateProfile } = require("./pathHandlers/profile");
const {
  getOrCreateDocument,
  createDocument,
  updateDocument,
  deleteDocument,
  requestShare,
  getIncomingRequests,
  getOutgoingRequests,
  grantAccess,
  removeRequest,
  getUserProfile,
  getUserAnalytics,
} = require("./pathHandlers/document");
const {
  createNetwork,
  listNetworks,
  getNetwork,
  joinNetwork,
  leaveNetwork,
  getNetworkFeed,
} = require("./pathHandlers/network");
const {
  getAdminOverview,
  listAdminUsers,
  getAdminUser,
  listAdminNetworks,
  updateAdminUserPassword,
  deleteAdminUser,
  deleteAdminDocument,
  deleteAdminNetwork,
} = require("./pathHandlers/admin");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: corsOrigin, methods: ["GET", "POST", "PUT", "DELETE"] },
});

const startServer = async () => {
  await connectDb();
  await seedAdminUsers();

  server.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
};

app.use(cors({ origin: corsOrigin }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/signup", signupHandler);
app.post("/login", loginHandler);

app.use(authenticate);

app.get("/document/:id", getOrCreateDocument);
app.post("/documents", createDocument);
app.put("/documents/:id", updateDocument);
app.delete("/documents/:id", deleteDocument);
app.post("/documents/:id/request", requestShare);
app.post("/documents/:id/requests/:requesterId/grant", grantAccess);
app.delete("/documents/:id/requests/:requesterId", removeRequest);
app.get("/users/:id/incoming-requests", getIncomingRequests);
app.get("/users/:id/outgoing-requests", getOutgoingRequests);
app.get("/users/:id/analytics", getUserAnalytics);
app.put("/users/:id/profile", updateProfile);
app.get("/users/:id", getUserProfile);

app.post("/networks", createNetwork);
app.get("/networks", listNetworks);
app.post("/networks/join", joinNetwork);
app.get("/networks/:id/feed", getNetworkFeed);
app.get("/networks/:id", getNetwork);
app.post("/networks/:id/leave", leaveNetwork);

app.get("/admin/overview", requireAdmin, getAdminOverview);
app.get("/admin/users", requireAdmin, listAdminUsers);
app.get("/admin/users/:id", requireAdmin, getAdminUser);
app.put("/admin/users/:id/password", requireAdmin, updateAdminUserPassword);
app.delete("/admin/users/:id", requireAdmin, deleteAdminUser);
app.get("/admin/networks", requireAdmin, listAdminNetworks);
app.delete("/admin/networks/:id", requireAdmin, deleteAdminNetwork);
app.delete("/admin/documents/:id", requireAdmin, deleteAdminDocument);

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication required"));
    }

    const decoded = verifyToken(token);
    socket.data.userId = decoded.id;
    next();
  } catch (error) {
    next(new Error("Invalid or expired token"));
  }
});

registerDocumentSockets(io);

app.use(errorHandler);

startServer();
