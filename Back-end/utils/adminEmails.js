const { adminEmails } = require("../config/env");

const isAdminEmail = (email) => {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return adminEmails.includes(normalized);
};

const promoteAdminIfListed = async (user) => {
  if (!user || !isAdminEmail(user.email) || user.role === "admin") {
    return user;
  }

  user.role = "admin";
  await user.save();
  return user;
};

module.exports = { isAdminEmail, promoteAdminIfListed };
