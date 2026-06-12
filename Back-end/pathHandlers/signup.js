const { Users } = require("../utils/model");
const bcrypt = require("bcrypt");
const asyncHandler = require("express-async-handler");
const { isAdminEmail } = require("../utils/adminEmails");

const signupHandler = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    throw new Error("Name, email, and password are required");
  }

  if (password.length < 6) {
    res.status(400);
    throw new Error("Password must be at least 6 characters");
  }

  const normalizedEmail = email.trim().toLowerCase();
  const userAlreadyExists = await Users.findOne({ email: normalizedEmail });

  if (userAlreadyExists) {
    res.status(400);
    throw new Error("User already exists with this email");
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await Users.create({
    name: name.trim(),
    email: normalizedEmail,
    password: hashedPassword,
    role: isAdminEmail(normalizedEmail) ? "admin" : "user",
  });

  res.status(201).json({
    _id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
});

module.exports = signupHandler;
