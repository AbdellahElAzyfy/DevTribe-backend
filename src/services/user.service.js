const User = require("../models/User");
const Post = require("../models/Post");
const Community = require("../models/Community");
const { isAdmin } = require("../helpers/post.helpers");

const isValidObjectId = (id) => {
  return id && /^[0-9a-fA-F]{24}$/.test(id.toString());
};

/**
 * Fetch a user's posts as the given viewer (`actor`), applying the same
 * visibility rules as the main post feed (see post.service `listPosts`):
 *   - only communities the viewer can see (public, or private + member)
 *   - never drafts
 *   - only approved posts, unless the viewer is an admin or viewing their own
 *     profile (so you still see your own pending posts on your own page)
 *
 * `actor` is null for unauthenticated requests, which restricts results to
 * public communities and approved posts only.
 */
const getAccessiblePostsForAuthor = async (authorId, actor) => {
  const filter = [{ author: authorId }, { isDraft: false }];

  if (!isAdmin(actor)) {
    const accessibleCommunities = await Community.find({
      $or: [{ isPrivate: false }, { "members.user": actor?.id }],
    }).select("_id");

    filter.push({ community: { $in: accessibleCommunities.map((c) => c._id) } });
  }

  const isOwnProfile = actor?.id && actor.id.toString() === authorId.toString();
  if (!isAdmin(actor) && !isOwnProfile) {
    filter.push({ isApproved: true });
  }

  const [posts, postCount] = await Promise.all([
    Post.find({ $and: filter })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate("author", "username avatar role")
      .populate("community", "name slug")
      .lean(),
    Post.countDocuments({ $and: filter }),
  ]);

  return { posts, postCount };
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

const getUserByUsername = async (username, actor = null) => {
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

  const { posts, postCount } = await getAccessiblePostsForAuthor(user._id, actor);

  return {
    user: toPublicUser(user),
    posts,
    stats: {
      postCount,
    },
  };
};

const getUserById = async (userId, actor = null) => {
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

  const { posts, postCount } = await getAccessiblePostsForAuthor(user._id, actor);

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
