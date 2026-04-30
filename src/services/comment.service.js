const Post = require("../models/Post");
const Comment = require("../models/Comment");
const Vote = require("../models/Vote");
const {
  isAdmin,
  getCommunityMembership,
  toPublicUser,
  findPostContext,
  findCommentContext,
  ensureCanViewPost,
  buildPagination,
} = require("../helpers/post.helpers");

const toPublicComment = (comment) => ({
  id: comment._id ?? comment.id,
  post: comment.post?._id ?? comment.post,
  parentComment: comment.parentComment?._id ?? comment.parentComment ?? null,
  author: toPublicUser(comment.author),
  content: comment.content,
  voteCount: comment.voteCount,
  isEdited: comment.isEdited,
  editedAt: comment.editedAt,
  createdAt: comment.createdAt,
  updatedAt: comment.updatedAt,
});

const normalizeContent = (value) => (typeof value === "string" ? value.trim() : "");

const ensureCanModerateComment = (comment, community, actor, { forEdit = false } = {}) => {
  const isAuthor = comment.author._id.toString() === actor?.id?.toString();
  const membership = getCommunityMembership(community, actor?.id);
  const canModerate = membership && ["owner", "moderator"].includes(membership.role);

  // Deletion: authors, owners, moderators, and admins may delete
  if (!forEdit) {
    if (isAuthor || canModerate || isAdmin(actor)) return;

    const error = new Error("You are not allowed to delete this comment");
    error.statusCode = 403;
    throw error;
  }

  // Edit: only the author may edit their comment
  if (forEdit) {
    if (isAuthor) return;

    const error = new Error("You are not allowed to edit this comment");
    error.statusCode = 403;
    throw error;
  }
};

const listComments = async (postId, actor, { page = 1, limit = 20 } = {}) => {
  const { post, community } = await findPostContext(postId);
  ensureCanViewPost(post, community, actor);

  const pagination = buildPagination({ page, limit });
  const skip = (pagination.page - 1) * pagination.limit;

  const query = { post: post._id };
  const [comments, total] = await Promise.all([
    Comment.find(query)
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(pagination.limit)
      .populate("author", "username avatar role"),
    Comment.countDocuments(query),
  ]);

  return {
    comments: comments.map((comment) => toPublicComment(comment)),
    page: pagination.page,
    limit: pagination.limit,
    total,
    totalPages: Math.ceil(total / pagination.limit),
  };
};

const createComment = async (postId, payload, actor) => {
  const content = normalizeContent(payload.content);
  const parentCommentId = payload.parentCommentId ?? null;

  if (!content) {
    const error = new Error("Content is required");
    error.statusCode = 400;
    throw error;
  }

  const { post, community } = await findPostContext(postId);
  ensureCanViewPost(post, community, actor);

  // Validate parent comment if provided
  let parentComment = null;
  if (parentCommentId) {
    parentComment = await Comment.findById(parentCommentId);
    if (!parentComment) {
      const error = new Error("Parent comment not found");
      error.statusCode = 404;
      throw error;
    }
    if (parentComment.post.toString() !== post._id.toString()) {
      const error = new Error("Parent comment must be from the same post");
      error.statusCode = 400;
      throw error;
    }
  }

  const comment = await Comment.create({
    post: post._id,
    author: actor.id,
    content,
    parentComment: parentCommentId,
  });

  await Post.updateOne({ _id: post._id }, { $inc: { commentCount: 1 } });

  const createdComment = await Comment.findById(comment._id)
    .populate("author", "username avatar role")
    .populate("parentComment");

  return toPublicComment(createdComment);
};

const updateComment = async (commentId, payload, actor) => {
  const { comment, post, community } = await findCommentContext(commentId);
  ensureCanViewPost(post, community, actor);
  ensureCanModerateComment(comment, community, actor, { forEdit: true });

  const content = normalizeContent(payload?.content);

  if (!content) {
    const error = new Error("Content is required");
    error.statusCode = 400;
    throw error;
  }

  comment.content = content;
  comment.isEdited = true;
  comment.editedAt = new Date();

  await comment.save();

  const updatedComment = await Comment.findById(comment._id).populate(
    "author",
    "username avatar role"
  );

  return toPublicComment(updatedComment);
};

const deleteComment = async (commentId, actor) => {
  const { comment, post, community } = await findCommentContext(commentId);
  ensureCanViewPost(post, community, actor);
  ensureCanModerateComment(comment, community, actor, { forEdit: false });

  // Find and delete all child replies
  const childComments = await Comment.find({ parentComment: comment._id });
  const childCommentIds = childComments.map((c) => c._id);
  let deletedCount = 1;

  if (childCommentIds.length > 0) {
    // Delete votes for all child comments
    await Vote.deleteMany({ targetType: "comment", targetId: { $in: childCommentIds } });
    // Delete all child comments
    await Comment.deleteMany({ parentComment: comment._id });
    deletedCount += childCommentIds.length;
  }

  // Delete votes for the parent comment
  await Vote.deleteMany({ targetType: "comment", targetId: comment._id });
  await comment.deleteOne();
  await Post.updateOne({ _id: post._id }, { $inc: { commentCount: -deletedCount } });

  return toPublicComment(comment);
};

module.exports = {
  listComments,
  createComment,
  updateComment,
  deleteComment,
  toPublicComment,
};
