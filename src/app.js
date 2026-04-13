const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

const { apiLimiter } = require("./middleware/rateLimiter");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");
const healthRoutes = require("./routes/health.routes");
const authRoutes = require("./routes/auth.routes");

const buildApp = ({ clientOrigin }) => {
  const app = express();

  app.use(
    cors({
      origin: clientOrigin,
      credentials: true,
    })
  );
  app.use(helmet());
  app.use(morgan("dev"));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(apiLimiter);

  app.use("/api/v1", healthRoutes);
  app.use("/api/v1/auth", authRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
};

module.exports = {
  buildApp,
};
