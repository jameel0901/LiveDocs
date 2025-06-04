const { Users } = require("../utils/model");
const bcrypt = require("bcrypt");
const asyncHandler = require('express-async-handler');

const signupHandler = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    return res.send("All fields are mandatory");
  }

  const userAlreadyExists = await Users.findOne({ email });

  if (userAlreadyExists) {
    res.status(400);
    return res.send("User Already Exists with this Email");
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await Users.create({
    name,
    email,
    password: hashedPassword,
  });

  if (user) {
    res.status(201).json({ _id: user.id, email: user.email });
  }
});

module.exports = signupHandler;
