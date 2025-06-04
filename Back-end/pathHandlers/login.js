const { Users } = require("../utils/model");
const bcrypt = require("bcrypt");
const asyncHandler = require("express-async-handler");

const loginHandler = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400);
    return res.send("All fields are mandatory");
  }
  const user = await Users.findOne({ email });
  if (user && (await bcrypt.compare(password, user.password))) {
    return res.json({ _id: user.id, email: user.email });
  }
  res.status(401).send("Invalid email or password");
});

module.exports = loginHandler;
