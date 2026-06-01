const SavedPost = require("../models/SavedPost");
const Post = require("../models/Post");
const toggleSave = async (postId, userId) => {
  const post = await Post.findById(postId);
  if (!post) {
    const error = new Error("Post not found");
    error.statusCode = 404;
    throw error;
  }
  
  const existing = await SavedPost.findOne({ post: postId, user: userId });

  if (existing) {
    await SavedPost.deleteOne({ _id: existing._id });
    return { isSaved: false };
  }

  await SavedPost.create({ post: postId, user: userId });
  return { isSaved: true };
};

const listSavedPosts = async (userId) => {
  const saved = await SavedPost.find({ user: userId })
    .sort({ createdAt: -1 })
    .populate({
      path: "post",
      populate: [
        { path: "author", select: "username avatar role" },
        { path: "community", select: "name slug description" }
      ]
    });

  return saved
    .filter(item => item.post && item.post.isApproved !== false) // Filter out deleted or pending posts
    .map(item => item.post);
};

const isPostSaved = async (postId, userId) => {
  if (!userId) return false;
  const count = await SavedPost.countDocuments({ post: postId, user: userId });
  return count > 0;
};

const getSavedPostIds = async (postIds, userId) => {
  if (!userId || !postIds.length) return new Set();
  
  const saved = await SavedPost.find({
    user: userId,
    post: { $in: postIds }
  }).select("post");
  
  return new Set(saved.map(s => s.post.toString()));
};

module.exports = {
  toggleSave,
  listSavedPosts,
  isPostSaved,
  getSavedPostIds,
};
