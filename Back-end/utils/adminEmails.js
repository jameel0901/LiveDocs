const { adminEmails } = require("../config/env");

const isAdminEmail = (email) => {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return adminEmails.includes(normalized);
};

module.exports = { isAdminEmail };
