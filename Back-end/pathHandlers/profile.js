const { Users } = require("../utils/model");
const bcrypt = require("bcrypt");
const asyncHandler = require("express-async-handler");

const updateProfile = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, email, currentPassword, newPassword } = req.body;

  if (id !== req.user.id) {
    res.status(403);
    throw new Error("You can only update your own profile");
  }

  const user = await Users.findById(id).select("+password");
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  const updates = {};

  if (name !== undefined) {
    const trimmedName = name.trim();
    if (!trimmedName) {
      res.status(400);
      throw new Error("Name cannot be empty");
    }

    const nameTaken = await Users.findOne({
      name: trimmedName,
      _id: { $ne: id },
    });

    if (nameTaken) {
      res.status(400);
      throw new Error("Name already taken");
    }

    updates.name = trimmedName;
  }

  if (email !== undefined) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      res.status(400);
      throw new Error("Email cannot be empty");
    }

    const emailTaken = await Users.findOne({
      email: normalizedEmail,
      _id: { $ne: id },
    });

    if (emailTaken) {
      res.status(400);
      throw new Error("Email already in use");
    }

    updates.email = normalizedEmail;
  }

  if (newPassword !== undefined) {
    if (!currentPassword) {
      res.status(400);
      throw new Error("Current password is required to set a new password");
    }

    if (newPassword.length < 6) {
      res.status(400);
      throw new Error("New password must be at least 6 characters");
    }

    const passwordMatches = await bcrypt.compare(currentPassword, user.password);
    if (!passwordMatches) {
      res.status(401);
      throw new Error("Current password is incorrect");
    }

    updates.password = await bcrypt.hash(newPassword, 10);
  }

  if (Object.keys(updates).length === 0) {
    res.status(400);
    throw new Error("No profile changes provided");
  }

  const updatedUser = await Users.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true,
  });

  res.json({
    _id: updatedUser.id,
    name: updatedUser.name,
    email: updatedUser.email,
    message: "Profile updated successfully",
  });
});

module.exports = { updateProfile };
