const { Server } = require("socket.io");

const authenticateSocket = require("../middleware/socket/authenticateSocket");

const createSocketServer = (httpServer, { clientOrigin }) => {
  const io = new Server(httpServer, {
    cors: {
      origin: clientOrigin,
      credentials: true,
    },
  });

  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    if (socket.user?.id) {
      socket.join(`user:${socket.user.id}`);
    }

    // Server-side: join all community rooms the user is a member of (non-blocking)
    const joinUserRooms = require("./helpers/joinUserRooms");
    joinUserRooms(socket);

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

module.exports = {
  createSocketServer,
};
