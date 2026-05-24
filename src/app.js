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
const communityRoutes = require("./routes/community.routes");
const postRoutes = require("./routes/post.routes");
const commentRoutes = require("./routes/comment.routes");
const notificationRoutes = require("./routes/notification.routes");

const buildApp = ({ clientOrigin }) => {
  const app = express();

  app.use(
    cors({
      origin: clientOrigin,
      credentials: true,
    })
  );
  app.use(
    helmet({
      crossOriginResourcePolicy: false,
    })
  );
  app.use(morgan("dev"));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(apiLimiter);

  const path = require("path");
  app.use("/uploads", express.static(path.join(__dirname, "../public/uploads")));

  app.use("/api/v1", healthRoutes);
  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/communities", communityRoutes);
  app.use("/api/v1/posts", postRoutes);
  app.use("/api/v1/comments", commentRoutes);
  app.use("/api/v1/notifications", notificationRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
};

module.exports = {
  buildApp,
};
