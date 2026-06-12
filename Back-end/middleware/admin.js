const asyncHandler = require("express-async-handler");
const { Users } = require("../utils/model");

const requireAdmin = asyncHandler(async (req, res, next) => {
  const user = await Users.findById(req.user.id).select("role").lean();

  if (!user || user.role !== "admin") {
    res.status(403);
    throw new Error("Admin access required");
  }

  next();
});

module.exports = { requireAdmin };
