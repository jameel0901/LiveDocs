const { Users } = require("../utils/model");
const bcrypt = require("bcrypt");
const asyncHandler = require("express-async-handler");
const { signToken } = require("../utils/token");
const { promoteAdminIfListed } = require("../utils/adminEmails");

const loginHandler = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error("Email and password are required");
  }

  const user = await Users.findOne({ email: email.trim().toLowerCase() }).select(
    "+password"
  );

  if (!user || !(await bcrypt.compare(password, user.password))) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  await promoteAdminIfListed(user);

  res.json({
    _id: user.id,
    name: user.name,
    email: user.email,
    role: user.role || "user",
    token: signToken(user.id),
  });
});

module.exports = loginHandler;
