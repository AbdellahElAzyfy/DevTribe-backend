const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const env = require("../config/env");

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL = "7d";

const createJti = () => crypto.randomUUID();

const signAccessToken = (user, sessionId) =>
  jwt.sign(
    {
      sub: user._id.toString(),
      sid: sessionId,
      role: user.role,
      username: user.username,
    },
    env.jwtAccessSecret,
    { expiresIn: ACCESS_TOKEN_TTL }
  );

const signRefreshToken = (userId, jti) =>
  jwt.sign(
    {
      sub: userId.toString(),
      jti,
      type: "refresh",
    },
    env.jwtRefreshSecret,
    { expiresIn: REFRESH_TOKEN_TTL }
  );

const verifyAccessToken = (token) => jwt.verify(token, env.jwtAccessSecret);
const verifyRefreshToken = (token) => jwt.verify(token, env.jwtRefreshSecret);

module.exports = {
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL,
  createJti,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
