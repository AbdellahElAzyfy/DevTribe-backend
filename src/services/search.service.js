const Post = require("../models/Post");
const Community = require("../models/Community");
const User = require("../models/User");
const { isAdmin, buildPagination } = require("../helpers/post.helpers");
const voteService = require("./vote.service");
const savedPostService = require("./savedPost.service");
const { toPublicPost } = require("./post.service");

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildQueryRegex = (q) => new RegExp(escapeRegex(q.trim()), "i");

const toPublicCommunity = (community, postsCount = 0, actorId = null) => {
  const isJoined = actorId
    ? (community.members ?? []).some(
        (m) => (m.user?._id ?? m.user)?.toString() === actorId.toString()
      )
    : false;

  return {
    id: community._id,
    name: community.name,
    slug: community.slug,
    description: community.description,
    createdBy: community.createdBy,
    isPrivate: community.isPrivate,
    memberCount: community.memberCount,
    isJoined,
    postsCount,
    createdAt: community.createdAt,
    updatedAt: community.updatedAt,
  };
};

const toPublicSearchUser = (user) => ({
  _id: user._id,
  username: user.username,
  avatar: user.avatar,
  bio: user.bio,
  role: user.role,
  createdAt: user.createdAt,
});

const getAccessibleCommunityIds = async (actor) => {
  if (isAdmin(actor)) {
    return null;
  }

  const accessibleCommunities = await Community.find({
    $or: [{ isPrivate: false }, { "members.user": actor?.id }],
  }).select("_id");

  return accessibleCommunities.map((c) => c._id);
};

const searchPosts = async (q, { page, limit } = {}, actor) => {
  const pagination = buildPagination({ page, limit });
  const skip = (pagination.page - 1) * pagination.limit;
  const regex = buildQueryRegex(q);

  const filter = [{ isDraft: false }, { isApproved: true }, {
    $or: [{ title: regex }, { content: regex }, { tags: regex }],
  }];

  const accessibleCommunityIds = await getAccessibleCommunityIds(actor);
  if (accessibleCommunityIds !== null) {
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

  const query = { $and: filter };

  const [posts, total] = await Promise.all([
    Post.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pagination.limit)
      .populate("author", "username avatar role")
      .populate("community", "name slug description createdBy isPrivate memberCount"),
    Post.countDocuments(query),
  ]);

  const postIds = posts.map((p) => p._id);
  const userVotes = actor ? await voteService.getVotesForTargets("post", postIds, actor.id) : {};
  const savedPostIds = actor
    ? await savedPostService.getSavedPostIds(postIds, actor.id)
    : new Set();

  return {
    posts: posts.map((post) =>
      toPublicPost(
        post,
        userVotes[post._id.toString()] || 0,
        actor ? savedPostIds.has(post._id.toString()) : false
      )
    ),
    page: pagination.page,
    limit: pagination.limit,
    total,
    totalPages: Math.ceil(total / pagination.limit),
  };
};

const searchCommunities = async (q, { page, limit } = {}, actor) => {
  const pagination = buildPagination({ page, limit });
  const skip = (pagination.page - 1) * pagination.limit;
  const regex = buildQueryRegex(q);

  const query = {
    $or: [{ name: regex }, { slug: regex }, { description: regex }],
  };

  const [communities, total] = await Promise.all([
    Community.find(query)
      .sort({ memberCount: -1, createdAt: -1 })
      .skip(skip)
      .limit(pagination.limit)
      .populate("members.user", "username avatar"),
    Community.countDocuments(query),
  ]);

  const communityIds = communities.map((c) => c._id);
  const postsCounts = await Post.aggregate([
    { $match: { community: { $in: communityIds } } },
    { $group: { _id: "$community", count: { $sum: 1 } } },
  ]);
  const postsCountMap = postsCounts.reduce((acc, item) => {
    acc[item._id.toString()] = item.count;
    return acc;
  }, {});

  return {
    communities: communities.map((community) =>
      toPublicCommunity(community, postsCountMap[community._id.toString()] || 0, actor?.id)
    ),
    page: pagination.page,
    limit: pagination.limit,
    total,
    totalPages: Math.ceil(total / pagination.limit),
  };
};

const searchUsers = async (q, { page, limit } = {}) => {
  const pagination = buildPagination({ page, limit });
  const skip = (pagination.page - 1) * pagination.limit;
  const regex = buildQueryRegex(q);

  const query = {
    isActive: true,
    $or: [{ username: regex }, { bio: regex }],
  };

  const [users, total] = await Promise.all([
    User.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pagination.limit)
      .lean(),
    User.countDocuments(query),
  ]);

  return {
    users: users.map(toPublicSearchUser),
    page: pagination.page,
    limit: pagination.limit,
    total,
    totalPages: Math.ceil(total / pagination.limit),
  };
};

const searchAll = async (q, actor) => {
  const previewLimit = { page: 1, limit: 5 };

  const [postsResult, communitiesResult, usersResult] = await Promise.all([
    searchPosts(q, previewLimit, actor),
    searchCommunities(q, previewLimit, actor),
    searchUsers(q, previewLimit),
  ]);

  return {
    posts: { items: postsResult.posts, total: postsResult.total },
    communities: { items: communitiesResult.communities, total: communitiesResult.total },
    users: { items: usersResult.users, total: usersResult.total },
  };
};

module.exports = {
  searchPosts,
  searchCommunities,
  searchUsers,
  searchAll,
};
