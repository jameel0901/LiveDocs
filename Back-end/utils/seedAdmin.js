const bcrypt = require("bcrypt");
const { Users } = require("./model");
const {
  adminEmails,
  adminPassword,
  adminSeedOnStartup,
  isProduction,
} = require("../config/env");

const seedAdminUsers = async () => {
  if (!adminSeedOnStartup) {
    if (isProduction && adminPassword) {
      console.warn(
        "ADMIN_PASSWORD is set but ADMIN_SEED_ON_STARTUP is disabled. Admin seed skipped."
      );
    }
    return;
  }

  if (!adminPassword || adminEmails.length === 0) {
    console.warn("Admin seed skipped: set ADMIN_EMAILS and ADMIN_PASSWORD.");
    return;
  }

  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  for (const email of adminEmails) {
    const existing = await Users.findOne({ email }).select("+password");

    if (existing) {
      existing.role = "admin";
      existing.password = hashedPassword;
      await existing.save();
      console.log(`Admin account ready: ${email}`);
      continue;
    }

    const localPart = email.split("@")[0] || "admin";
    const displayName =
      localPart.charAt(0).toUpperCase() + localPart.slice(1).replace(/[._]/g, " ");

    await Users.create({
      name: displayName,
      email,
      password: hashedPassword,
      role: "admin",
    });
    console.log(`Admin account created: ${email}`);
  }
};

module.exports = { seedAdminUsers };
