const User = require("../models/User");
const Post = require("../models/Post");

const isValidObjectId = (id) => {
  return id && /^[0-9a-fA-F]{24}$/.test(id.toString());
};

const toPublicUser = (user) => {
  if (!user) return null;

  return {
    _id: user._id,
    username: user.username,
    avatar: user.avatar,
    bio: user.bio,
    role: user.role,
    createdAt: user.createdAt,
  };
};

const getUserByUsername = async (username) => {
  if (!username || typeof username !== "string") {
    const error = new Error("Username is required");
    error.statusCode = 400;
    throw error;
  }

  const trimmedUsername = username.trim();
  if (trimmedUsername.length < 3 || trimmedUsername.length > 30) {
    const error = new Error("Username must be between 3 and 30 characters");
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findOne({ username: trimmedUsername }).lean();

  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  const posts = await Post.find({ author: user._id, isDraft: false })
    .sort({ createdAt: -1 })
    .limit(20)
    .populate("author", "username avatar role")
    .populate("community", "name slug")
    .lean();

  const postCount = await Post.countDocuments({ author: user._id, isDraft: false });

  return {
    user: toPublicUser(user),
    posts,
    stats: {
      postCount,
    },
  };
};

const getUserById = async (userId) => {
  if (!isValidObjectId(userId)) {
    const error = new Error("Invalid user id");
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findById(userId).lean();

  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  const posts = await Post.find({ author: user._id, isDraft: false })
    .sort({ createdAt: -1 })
    .limit(20)
    .populate("author", "username avatar role")
    .populate("community", "name slug")
    .lean();

  const postCount = await Post.countDocuments({ author: user._id, isDraft: false });

  return {
    user: toPublicUser(user),
    posts,
    stats: {
      postCount,
    },
  };
};

module.exports = {
  getUserByUsername,
  getUserById,
};
