const Post = require("../models/Post");
const Community = require("../models/Community");
const Vote = require("../models/Vote");
const Comment = require("../models/Comment");
const {
  isValidObjectId,
  isAdmin,
  getCommunityMembership,
  toPublicUser,
  findCommunityByIdentifier,
  ensureCanViewPost,
  buildPagination,
} = require("../helpers/post.helpers");

const normalizeTags = (tags) => {
  if (!Array.isArray(tags)) {
    return [];
  }

  const uniqueTags = new Set();

  tags.forEach((tag) => {
    if (typeof tag !== "string") {
      return;
    }

    const normalizedTag = tag.trim().toLowerCase();
    if (normalizedTag) {
      uniqueTags.add(normalizedTag);
    }
  });

  return [...uniqueTags];
};

const normalizeImage = (image) => {
  if (typeof image !== "string") {
    return null;
  }

  const trimmedImage = image.trim();
  return trimmedImage || null;
};

const toPublicCommunity = (community) => {
  if (!community) {
    return null;
  }

  return {
    id: community._id ?? community.id,
    name: community.name,
    slug: community.slug,
    description: community.description,
    createdBy: community.createdBy,
    isPrivate: community.isPrivate,
    memberCount: community.memberCount,
  };
};

const toPublicPost = (post) => {
  if (!post) {
    return null;
  }

  return {
    id: post._id ?? post.id,
    title: post.title,
    content: post.content,
    image: post.image,
    tags: post.tags ?? [],
    voteCount: post.voteCount,
    commentCount: post.commentCount,
    isDraft: post.isDraft,
    isPinned: post.isPinned,
    author: toPublicUser(post.author),
    community: toPublicCommunity(post.community),
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
};

const getSortOption = (sortBy = "newest") => {
  if (sortBy === "oldest") {
    return { isPinned: -1, createdAt: 1 };
  }

  if (sortBy === "top") {
    return { isPinned: -1, voteCount: -1, createdAt: -1 };
  }

  return { isPinned: -1, createdAt: -1 };
};

const findPostById = async (postId) => {
  if (!isValidObjectId(postId)) {
    const error = new Error("Invalid post id");
    error.statusCode = 400;
    throw error;
  }

  const post = await Post.findById(postId)
    .populate("author", "username avatar role")
    .populate("community", "name slug description createdBy isPrivate memberCount members")
    .populate("community.members.user", "username email avatar role");

  if (!post) {
    const error = new Error("Post not found");
    error.statusCode = 404;
    throw error;
  }

  return post;
};

const isCommunityModerator = (community, actor) => {
  const membership = getCommunityMembership(community, actor?.id);
  return Boolean(membership && ["owner", "moderator"].includes(membership.role));
};

const ensureCanViewCommunity = (community, actor) => {
  if (!community.isPrivate || isAdmin(actor)) {
    return;
  }

  const membership = getCommunityMembership(community, actor?.id);

  if (!membership) {
    const error = new Error("You do not have access to this community");
    error.statusCode = 403;
    throw error;
  }
};

const ensureCanCreatePost = (community, actor) => {
  if (isAdmin(actor)) {
    return;
  }

  const membership = getCommunityMembership(community, actor?.id);

  if (!membership) {
    const error = new Error("You must join the community before posting");
    error.statusCode = 403;
    throw error;
  }
};

const ensureCanEditPost = (post, actor, requestedFields = []) => {
  if (isAdmin(actor)) {
    return;
  }

  const isAuthor = post.author._id.toString() === actor?.id?.toString();
  const canModerate = isCommunityModerator(post.community, actor);

  const editableFields = ["title", "content", "image", "tags", "isDraft"];
  const moderationFields = ["isPinned"];

  const allowedFields = isAuthor ? editableFields : canModerate ? moderationFields : [];

  if (!allowedFields.length) {
    const error = new Error("You are not allowed to modify this post");
    error.statusCode = 403;
    throw error;
  }

  const unauthorizedFields = requestedFields.filter((field) => !allowedFields.includes(field));

  if (unauthorizedFields.length > 0) {
    const error = new Error("You are not allowed to modify some of these fields");
    error.statusCode = 403;
    throw error;
  }
};

const ensureCanDeletePost = (post, actor) => {
  if (isAdmin(actor)) {
    return;
  }

  const isAuthor = post.author._id.toString() === actor?.id?.toString();
  const canModerate = isCommunityModerator(post.community, actor);

  if (!isAuthor && !canModerate) {
    const error = new Error("You are not allowed to delete this post");
    error.statusCode = 403;
    throw error;
  }
};

const buildPostUpdatePayload = (payload) => {
  const updates = {};

  if (payload.title !== undefined) {
    updates.title = typeof payload.title === "string" ? payload.title.trim() : payload.title;
  }

  if (payload.content !== undefined) {
    updates.content =
      typeof payload.content === "string" ? payload.content.trim() : payload.content;
  }

  if (payload.image !== undefined) {
    updates.image = normalizeImage(payload.image);
  }

  if (payload.tags !== undefined) {
    updates.tags = normalizeTags(payload.tags);
  }

  if (payload.isDraft !== undefined) {
    updates.isDraft = Boolean(payload.isDraft);
  }

  if (payload.isPinned !== undefined) {
    updates.isPinned = Boolean(payload.isPinned);
  }

  return updates;
};

const listPosts = async ({ communityId, authorId, page, limit, sortBy } = {}, actor) => {
  const pagination = buildPagination({ page, limit });
  const filter = [];
  let accessibleCommunityIds = null;

  if (!isAdmin(actor)) {
    const accessibleCommunities = await Community.find({
      $or: [{ isPrivate: false }, { "members.user": actor?.id }],
    }).select("_id");

    accessibleCommunityIds = accessibleCommunities.map((community) => community._id);

    if (accessibleCommunityIds.length === 0) {
      return {
        posts: [],
        page: pagination.page,
        limit: pagination.limit,
        total: 0,
        totalPages: 0,
      };
    }

    filter.push({ community: { $in: accessibleCommunityIds } });
  }

  if (communityId) {
    const community = await findCommunityByIdentifier(communityId);
    ensureCanViewCommunity(community, actor);
    filter.push({ community: community._id });
  }

  if (authorId) {
    if (!isValidObjectId(authorId)) {
      const error = new Error("Invalid author id");
      error.statusCode = 400;
      throw error;
    }

    filter.push({ author: authorId });
  }

  filter.push({ isDraft: false });

  const query = filter.length > 0 ? { $and: filter } : { isDraft: false };
  const sort = getSortOption(sortBy);
  const skip = (pagination.page - 1) * pagination.limit;

  const [posts, total] = await Promise.all([
    Post.find(query)
      .sort(sort)
      .skip(skip)
      .limit(pagination.limit)
      .populate("author", "username avatar role")
      .populate("community", "name slug description createdBy isPrivate memberCount"),
    Post.countDocuments(query),
  ]);

  return {
    posts: posts.map((post) => toPublicPost(post)),
    page: pagination.page,
    limit: pagination.limit,
    total,
    totalPages: Math.ceil(total / pagination.limit),
  };
};

const createPost = async (payload, actor) => {
  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const content = typeof payload.content === "string" ? payload.content.trim() : "";
  const image = normalizeImage(payload.image);
  const tags = normalizeTags(payload.tags);
  const isDraft = Boolean(payload.isDraft);
  const isPinned = Boolean(payload.isPinned);
  const communityIdentifier = payload.communityId ?? payload.communitySlug ?? payload.community;

  if (!title) {
    const error = new Error("Title is required");
    error.statusCode = 400;
    throw error;
  }

  if (!content) {
    const error = new Error("Content is required");
    error.statusCode = 400;
    throw error;
  }

  const community = await findCommunityByIdentifier(communityIdentifier);
  ensureCanCreatePost(community, actor);

  if (isPinned && !isAdmin(actor) && !isCommunityModerator(community, actor)) {
    const error = new Error("You are not allowed to pin posts");
    error.statusCode = 403;
    throw error;
  }

  const post = await Post.create({
    title,
    content,
    image,
    tags,
    isDraft,
    isPinned,
    author: actor.id,
    community: community._id,
  });

  const createdPost = await Post.findById(post._id)
    .populate("author", "username avatar role")
    .populate("community", "name slug description createdBy isPrivate memberCount");

  return toPublicPost(createdPost);
};

const getPost = async (postId, actor) => {
  const post = await findPostById(postId);
  ensureCanViewPost(post, post.community, actor);
  return toPublicPost(post);
};

const updatePost = async (postId, payload, actor) => {
  const post = await findPostById(postId);

  const requestedFields = Object.keys(payload).filter((field) => payload[field] !== undefined);

  ensureCanEditPost(post, actor, requestedFields);

  Object.assign(post, buildPostUpdatePayload(payload));

  await post.save();

  const updatedPost = await Post.findById(post._id)
    .populate("author", "username avatar role")
    .populate("community", "name slug description createdBy isPrivate memberCount");

  return toPublicPost(updatedPost);
};

const deletePost = async (postId, actor) => {
  const post = await findPostById(postId);
  ensureCanDeletePost(post, actor);

  await Vote.deleteMany({ targetType: "post", targetId: post._id });
  const commentIds = await Comment.find({ post: post._id }).distinct("_id");
  if (commentIds.length > 0) {
    await Vote.deleteMany({ targetType: "comment", targetId: { $in: commentIds } });
  }
  await Comment.deleteMany({ post: post._id });
  await post.deleteOne();

  return toPublicPost(post);
};

const listMyDrafts = async ({ page, limit, communityId } = {}, actor) => {
  const pagination = buildPagination({ page, limit });
  const filter = [{ isDraft: true, author: actor.id }];

  if (communityId) {
    const community = await findCommunityByIdentifier(communityId);
    ensureCanViewCommunity(community, actor);
    filter.push({ community: community._id });
  }

  const query = filter.length > 1 ? { $and: filter } : filter[0];
  const sort = { createdAt: -1 };
  const skip = (pagination.page - 1) * pagination.limit;

  const [posts, total] = await Promise.all([
    Post.find(query)
      .sort(sort)
      .skip(skip)
      .limit(pagination.limit)
      .populate("author", "username avatar role")
      .populate("community", "name slug description createdBy isPrivate memberCount"),
    Post.countDocuments(query),
  ]);

  return {
    posts: posts.map((post) => toPublicPost(post)),
    page: pagination.page,
    limit: pagination.limit,
    total,
    totalPages: Math.ceil(total / pagination.limit),
  };
};

module.exports = {
  listPosts,
  listMyDrafts,
  createPost,
  getPost,
  updatePost,
  deletePost,
  toPublicPost,
};
