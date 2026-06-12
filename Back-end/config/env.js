const path = require("path");
const dotenv = require("dotenv");

const envPath = path.join(__dirname, "..", ".env");
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.warn(`No .env file found at ${envPath}; using process environment variables`);
}

const readEnv = (key) => {
  const raw = process.env[key];
  if (raw === undefined || raw === null) return "";
  return String(raw).trim().replace(/^["']|["']$/g, "");
};

const nodeEnv = readEnv("NODE_ENV") || "development";
const isProduction = nodeEnv === "production";

const parseAdminEmails = () => {
  const raw = readEnv("ADMIN_EMAILS");
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
};

const parseBoolean = (value) => ["true", "1", "yes"].includes(value.toLowerCase());

const atlasUri = readEnv("ATLAS_URI");
const jwtSecret = readEnv("JWT_SECRET");
const corsOrigin = readEnv("CORS_ORIGIN");
const adminEmails = parseAdminEmails();
const adminPassword = readEnv("ADMIN_PASSWORD");
const adminSeedOnStartup = parseBoolean(readEnv("ADMIN_SEED_ON_STARTUP"));

const required = ["ATLAS_URI", "JWT_SECRET"];
const missing = required.filter((key) => !readEnv(key));

if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

if (isProduction) {
  if (jwtSecret.length < 32) {
    console.error("JWT_SECRET must be at least 32 characters in production");
    process.exit(1);
  }

  if (!corsOrigin || corsOrigin === "*") {
    console.error("CORS_ORIGIN must be set to your frontend URL in production (not *)");
    process.exit(1);
  }

  if (adminSeedOnStartup && !adminPassword) {
    console.error("ADMIN_PASSWORD is required when ADMIN_SEED_ON_STARTUP=true");
    process.exit(1);
  }
}

module.exports = {
  nodeEnv,
  isProduction,
  port: Number(readEnv("PORT")) || 5000,
  atlasUri,
  jwtSecret,
  jwtExpiresIn: readEnv("JWT_EXPIRES_IN") || "7d",
  corsOrigin: corsOrigin || (isProduction ? "" : "http://localhost:3000"),
  adminEmails,
  adminPassword,
  adminSeedOnStartup,
};
