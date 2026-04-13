const required = ["PORT", "MONGODB_URI", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"];

const validateEnv = () => {
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
};

module.exports = validateEnv;
