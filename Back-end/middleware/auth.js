const asyncHandler = require("express-async-handler");
const { verifyToken } = require("../utils/token");

const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    res.status(401);
    throw new Error("Authentication required");
  }

  try {
    const decoded = verifyToken(header.split(" ")[1]);
    req.user = { id: decoded.id };
    next();
  } catch (error) {
    res.status(401);
    throw new Error("Invalid or expired token");
  }
});

module.exports = { authenticate };
