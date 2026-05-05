const authenticate = require("../auth/authenticate");

const extractToken = (socket) => {
  const authToken = socket.handshake.auth?.token;
  if (authToken) {
    return authToken;
  }

  const authHeader = socket.handshake.headers?.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }

  return null;
};

const authenticateSocket = async (socket, next) => {
  try {
    const token = extractToken(socket);

    if (!token) {
      const error = new Error("Access token required for socket connection");
      error.data = { code: "AUTH_REQUIRED" };
      return next(error);
    }

    const user = await authenticate.verifyTokenAndSession(token);

    socket.user = {
      id: String(user.id),
      username: user.username,
      email: user.email,
      role: user.role,
    };

    return next();
  } catch (error) {
    const authError = new Error(error.message || "Invalid or expired access token");
    authError.data = { code: error.data?.code || "INVALID_TOKEN" };
    return next(authError);
  }
};

module.exports = authenticateSocket;
