const bcrypt = require("bcryptjs");
const User = require("../models/User");
const RefreshToken = require("../models/RefreshToken");
const {
  createJti,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} = require("./token.service");

const buildAuthPayload = (user) => ({
  user: {
    id: user._id,
    username: user.username,
    email: user.email,
    avatar: user.avatar,
    bio: user.bio,
    role: user.role,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  },
});

const getCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/api/v1/auth",
});

const createTokenPair = async (user) => {
  const jti = createJti();
  const accessToken = signAccessToken(user, jti);
  const refreshToken = signRefreshToken(user._id, jti);

  await RefreshToken.create({
    user: user._id,
    jti,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  return { accessToken, refreshToken };
};

const registerUser = async ({ username, email, password }) => {
  const existingUser = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (existingUser) {
    const error = new Error("Username or email already in use");
    error.statusCode = 409;
    throw error;
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await User.create({
    username,
    email,
    password: hashedPassword,
  });

  const { accessToken, refreshToken } = await createTokenPair(user);

  return {
    ...buildAuthPayload(user),
    accessToken,
    refreshToken,
  };
};

const loginUser = async ({ email, password }) => {
  const user = await User.findOne({ email }).select("+password");

  if (!user) {
    const error = new Error("Invalid credentials");
    error.statusCode = 401;
    throw error;
  }

  const passwordMatches = await bcrypt.compare(password, user.password);

  if (!passwordMatches) {
    const error = new Error("Invalid credentials");
    error.statusCode = 401;
    throw error;
  }

  user.lastLoginAt = new Date();
  await user.save();

  const { accessToken, refreshToken } = await createTokenPair(user);

  return {
    ...buildAuthPayload(user),
    accessToken,
    refreshToken,
  };
};

const refreshSession = async (refreshTokenValue) => {
  if (!refreshTokenValue) {
    const error = new Error("Refresh token is required");
    error.statusCode = 401;
    throw error;
  }

  let decoded;

  try {
    decoded = verifyRefreshToken(refreshTokenValue);
  } catch (error) {
    const invalidError = new Error("Invalid refresh token");
    invalidError.statusCode = 401;
    throw invalidError;
  }

  const tokenRecord = await RefreshToken.findOne({
    jti: decoded.jti,
    user: decoded.sub,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  });

  if (!tokenRecord) {
    const error = new Error("Refresh token revoked or not found");
    error.statusCode = 401;
    throw error;
  }

  const user = await User.findById(decoded.sub);
  if (!user || !user.isActive) {
    const error = new Error("User account is unavailable");
    error.statusCode = 401;
    throw error;
  }

  tokenRecord.revokedAt = new Date();

  const newJti = createJti();
  const newAccessToken = signAccessToken(user, newJti);
  const newRefreshToken = signRefreshToken(user._id, newJti);

  await RefreshToken.create({
    user: user._id,
    jti: newJti,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  tokenRecord.replacedByJti = newJti;
  await tokenRecord.save();

  return {
    ...buildAuthPayload(user),
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
};

const revokeRefreshToken = async (refreshTokenValue) => {
  if (!refreshTokenValue) {
    return;
  }

  try {
    const decoded = verifyRefreshToken(refreshTokenValue);
    await RefreshToken.updateOne(
      { jti: decoded.jti, user: decoded.sub },
      { $set: { revokedAt: new Date() } }
    );
  } catch (error) {
    return;
  }
};

const getCurrentUser = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  return buildAuthPayload(user);
};

const updateUserProfile = async (userId, { username, email, bio, avatar }) => {
  const user = await User.findById(userId);

  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  // Check if new email/username are already in use (by someone else)
  if (email && email !== user.email) {
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      const error = new Error("Email already in use");
      error.statusCode = 409;
      throw error;
    }
    user.email = email;
  }

  if (username && username !== user.username) {
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      const error = new Error("Username already in use");
      error.statusCode = 409;
      throw error;
    }
    user.username = username;
  }

  if (bio !== undefined) {
    user.bio = bio;
  }

  if (avatar !== undefined) {
    user.avatar = avatar;
  }

  await user.save();

  return buildAuthPayload(user);
};

const changeUserPassword = async (userId, { currentPassword, newPassword }) => {
  const user = await User.findById(userId).select("+password");

  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  const passwordMatches = await bcrypt.compare(currentPassword, user.password);

  if (!passwordMatches) {
    const error = new Error("Current password is incorrect");
    error.statusCode = 401;
    throw error;
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);
  user.password = hashedPassword;
  await user.save();

  return buildAuthPayload(user);
};

module.exports = {
  getCookieOptions,
  registerUser,
  loginUser,
  refreshSession,
  revokeRefreshToken,
  getCurrentUser,
  updateUserProfile,
  changeUserPassword,
};
