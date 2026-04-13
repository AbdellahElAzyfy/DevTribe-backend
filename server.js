const http = require("http");

const env = require("./src/config/env");
const validateEnv = require("./src/config/validateEnv");
const { connectDatabase } = require("./src/config/db");
const { buildApp } = require("./src/app");
const { createSocketServer } = require("./src/sockets");

const startServer = async () => {
  validateEnv();
  await connectDatabase(env.mongoUri);

  const app = buildApp({ clientOrigin: env.clientOrigin });
  const httpServer = http.createServer(app);
  const io = createSocketServer(httpServer, { clientOrigin: env.clientOrigin });

  httpServer.listen(env.port, () => {
    console.log(`DevTribe backend listening on port ${env.port}`);
  });

  return { httpServer, io };
};

startServer().catch((error) => {
  console.error("Failed to start server:", error.message);
  process.exit(1);
});
