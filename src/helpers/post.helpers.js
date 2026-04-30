const mongoose = require("mongoose");
const Post = require("../models/Post");
const Community = require("../models/Community");
const Comment = require("../models/Comment");

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const isAdmin = (actor) => actor?.role === "admin";

const buildPagination = ({ page = 1, limit = 20 } = {}) => {
  const parsedPage = Number.parseInt(page, 10);
  const parsedLimit = Number.parseInt(limit, 10);

  return {
    page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
    limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 50) : 20,
  };
};

const getCommunityMembership = (community, userId) => {
  if (!community || !userId || !Array.isArray(community.members)) {
    return null;
  }

  return community.members.find((entry) => {
    const memberUserId = entry?.user?._id ?? entry?.user?.id ?? entry?.user;
    return memberUserId?.toString() === userId.toString();
  });
};

const toPublicUser = (user) => {
  if (!user) {
    return null;
  }

  return {
    id: user._id ?? user.id,
    username: user.username,
    avatar: user.avatar,
    role: user.role,
  };
};

const findCommunityByIdentifier = async (identifier) => {
  if (!identifier) {
    const error = new Error("Community identifier is required");
    error.statusCode = 400;
    throw error;
  }

  const query = isValidObjectId(identifier)
    ? { _id: identifier }
    : { slug: identifier.toString().trim().toLowerCase() };

  const community = await Community.findOne(query).populate(
    "members.user",
    "username email avatar role"
  );

  if (!community) {
    const error = new Error("Community not found");
    error.statusCode = 404;
    throw error;
  }

  return community;
};

const findPostContext = async (postId) => {
  if (!isValidObjectId(postId)) {
    const error = new Error("Invalid post id");
    error.statusCode = 400;
    throw error;
  }

  const post = await Post.findById(postId)
    .populate("author", "username avatar role")
    .populate("community", "isPrivate members")
    .populate("community.members.user", "username email avatar role");

  if (!post) {
    const error = new Error("Post not found");
    error.statusCode = 404;
    throw error;
  }

  return { post, community: post.community };
};

const findCommentContext = async (commentId) => {
  if (!isValidObjectId(commentId)) {
    const error = new Error("Invalid comment id");
    error.statusCode = 400;
    throw error;
  }

  const comment = await Comment.findById(commentId).populate("author", "username avatar role");

  if (!comment) {
    const error = new Error("Comment not found");
    error.statusCode = 404;
    throw error;
  }

  const { post, community } = await findPostContext(comment.post);

  return { comment, post, community };
};

const ensureCanViewPost = (post, community, actor) => {
  if (isAdmin(actor)) {
    return;
  }

  const membership = getCommunityMembership(community, actor?.id);

  if (community.isPrivate && !membership) {
    const error = new Error("You do not have access to this resource");
    error.statusCode = 403;
    throw error;
  }

  if (post.isDraft && post.author._id.toString() !== actor?.id?.toString()) {
    const error = new Error("You do not have access to this resource");
    error.statusCode = 403;
    throw error;
  }
};

module.exports = {
  isValidObjectId,
  isAdmin,
  getCommunityMembership,
  toPublicUser,
  findCommunityByIdentifier,
  findPostContext,
  findCommentContext,
  ensureCanViewPost,
  buildPagination,
};
