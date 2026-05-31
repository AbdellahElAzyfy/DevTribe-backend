const { verifyAccessToken } = require("../../services/token.service");
const User = require("../../models/User");
const RefreshToken = require("../../models/RefreshToken");

const extractToken = (req) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }

  return null;
};

const verifyTokenAndSession = async (token) => {
  if (!token) {
    const error = new Error("Access token is required");
    error.statusCode = 401;
    throw error;
  }

  const decoded = verifyAccessToken(token);
  if (!decoded.sid) {
    const error = new Error("Access token session is invalid");
    error.statusCode = 401;
    throw error;
  }

  const activeSession = await RefreshToken.findOne({
    user: decoded.sub,
    jti: decoded.sid,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  });

  if (!activeSession) {
    const error = new Error("Session has been revoked");
    error.statusCode = 401;
    throw error;
  }

  const user = await User.findById(decoded.sub);

  if (!user || !user.isActive) {
    const error = new Error("User account is unavailable");
    error.statusCode = 401;
    throw error;
  }

  return {
    id: user._id,
    username: user.username,
    email: user.email,
    role: user.role,
  };
};

const authenticate = async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    const error = new Error("Access token is required");
    error.statusCode = 401;
    return next(error);
  }

  try {
    const user = await verifyTokenAndSession(token);

    req.user = user;

    return next();
  } catch (error) {
    const authError = new Error(error.message || "Invalid or expired access token");
    authError.statusCode = error.statusCode || 401;
    return next(authError);
  }
};

const optionalAuthenticate = async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    return next();
  }

  try {
    const decoded = verifyAccessToken(token);
    if (!decoded.sid) return next();

    const activeSession = await RefreshToken.findOne({
      user: decoded.sub,
      jti: decoded.sid,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    });

    if (!activeSession) return next();

    const user = await User.findById(decoded.sub);
    if (!user || !user.isActive) return next();

    req.user = {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
    };

    return next();
  } catch (error) {
    // If token is present but invalid, we still proceed as guest
    return next();
  }
};

module.exports = {
  authenticate,
  optionalAuthenticate,
  verifyTokenAndSession,
};
