const Community = require("../models/Community");
const Post = require("../models/Post");

const normalizeSlug = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const toPublicCommunity = (community, postsCount = 0, actorId = null) => {
  const membership = actorId
    ? community.members.find(
        (m) => (m.user._id ?? m.user).toString() === actorId.toString()
      )
    : null;
  const isJoined = Boolean(membership);
  const viewerRole = membership?.role ?? null;

  return {
    id: community._id,
    name: community.name,
    slug: community.slug,
    description: community.description,
    createdBy: community.createdBy,
    isPrivate: community.isPrivate,
    memberCount: community.memberCount,
    isJoined,
    viewerRole,
    postsCount,
    createdAt: community.createdAt,
    updatedAt: community.updatedAt,
  };
};

const findCommunityBySlug = async (slug) => {
  const community = await Community.findOne({ slug }).populate(
    "members.user",
    "username email avatar"
  );

  if (!community) {
    const error = new Error("Community not found");
    error.statusCode = 404;
    throw error;
  }

  return community;
};

const ensureCanManageCommunity = (community, user) => {
  if (user.role === "admin") {
    return;
  }

  const membership = community.members.find(
    (entry) => entry.user._id.toString() === user.id.toString()
  );

  if (!membership || membership.role !== "owner") {
    const error = new Error("Only the community owner or admin can perform this action");
    error.statusCode = 403;
    throw error;
  }
};

const listCommunities = async (actorId = null) => {
  const communities = await Community.find()
    .sort({ createdAt: -1 })
    .populate("members.user", "username email avatar");

  const results = await Promise.all(
    communities.map(async (community) => {
      const postsCount = await Post.countDocuments({ community: community._id });
      return toPublicCommunity(community, postsCount, actorId);
    })
  );

  return results;
};

const createCommunity = async ({ name, description, isPrivate }, userId) => {
  const existingByName = await Community.findOne({ name: name.trim() });

  if (existingByName) {
    const error = new Error("Community name is already taken");
    error.statusCode = 409;
    throw error;
  }

  const baseSlug = normalizeSlug(name);

  if (!baseSlug) {
    const error = new Error("Unable to generate a valid slug from name");
    error.statusCode = 400;
    throw error;
  }

  let slug = baseSlug;
  let suffix = 1;

  while (await Community.exists({ slug })) {
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }

  const community = await Community.create({
    name,
    slug,
    description,
    isPrivate,
    createdBy: userId,
    members: [
      {
        user: userId,
        role: "owner",
      },
    ],
    memberCount: 1,
  });

  return toPublicCommunity(community, 0, userId);
};

const getCommunity = async (slug, actorId = null) => {
  const community = await findCommunityBySlug(slug);
  const postsCount = await Post.countDocuments({ community: community._id });
  return toPublicCommunity(community, postsCount, actorId);
};

const joinCommunity = async (slug, userId) => {
  const community = await findCommunityBySlug(slug);
  const alreadyJoined = community.members.some(
    (entry) => entry.user._id.toString() === userId.toString()
  );

  if (alreadyJoined) {
    const postsCount = await Post.countDocuments({ community: community._id });
    return toPublicCommunity(community, postsCount, userId);
  }

  community.members.push({ user: userId, role: "member" });
  community.memberCount = community.members.length;
  await community.save();

  const updated = await findCommunityBySlug(slug);
  const postsCount = await Post.countDocuments({ community: updated._id });
  return toPublicCommunity(updated, postsCount, userId);
};

const leaveCommunity = async (slug, userId) => {
  const community = await findCommunityBySlug(slug);
  const memberToLeave = community.members.find(
    (entry) => entry.user._id.toString() === userId.toString()
  );

  if (!memberToLeave) {
    const error = new Error("You are not a member of this community");
    error.statusCode = 400;
    throw error;
  }

  if (memberToLeave.role === "owner") {
    const error = new Error("Community owner cannot leave the community");
    error.statusCode = 400;
    throw error;
  }

  community.members = community.members.filter(
    (entry) => entry.user._id.toString() !== userId.toString()
  );
  community.memberCount = community.members.length;
  await community.save();

  const updated = await findCommunityBySlug(slug);
  const postsCount = await Post.countDocuments({ community: updated._id });
  return toPublicCommunity(updated, postsCount, userId);
};

const updateMemberRole = async (slug, memberId, role, actor) => {
  const community = await findCommunityBySlug(slug);
  ensureCanManageCommunity(community, actor);

  const member = community.members.find(
    (entry) => entry.user._id.toString() === memberId.toString()
  );

  if (!member) {
    const error = new Error("Member not found in this community");
    error.statusCode = 404;
    throw error;
  }

  if (member.role === "owner") {
    const error = new Error("Owner role cannot be changed");
    error.statusCode = 400;
    throw error;
  }

  member.role = role;
  await community.save();

  const updated = await findCommunityBySlug(slug);
  const postsCount = await Post.countDocuments({ community: updated._id });
  return toPublicCommunity(updated, postsCount, actor.id);
};

const updateCommunity = async (slug, updates, actor) => {
  const community = await findCommunityBySlug(slug);
  ensureCanManageCommunity(community, actor);

  if (updates.name && updates.name !== community.name) {
    const existingByName = await Community.findOne({
      name: updates.name.trim(),
      _id: { $ne: community._id },
    });

    if (existingByName) {
      const error = new Error("Community name is already taken");
      error.statusCode = 409;
      throw error;
    }

    const baseSlug = normalizeSlug(updates.name);
    let nextSlug = baseSlug;
    let suffix = 1;

    while (
      await Community.exists({ slug: nextSlug, _id: { $ne: community._id } })
    ) {
      suffix += 1;
      nextSlug = `${baseSlug}-${suffix}`;
    }

    community.name = updates.name.trim();
    community.slug = nextSlug;
  }

  if (updates.description !== undefined) {
    community.description = updates.description;
  }

  if (updates.isPrivate !== undefined) {
    community.isPrivate = updates.isPrivate;
  }

  await community.save();

  const updated = await findCommunityBySlug(community.slug);
  const postsCount = await Post.countDocuments({ community: updated._id });
  return toPublicCommunity(updated, postsCount, actor.id);
};

const deleteCommunity = async (slug, actor) => {
  const community = await findCommunityBySlug(slug);
  ensureCanManageCommunity(community, actor);

  await community.deleteOne();
};

module.exports = {
  listCommunities,
  createCommunity,
  getCommunity,
  joinCommunity,
  leaveCommunity,
  updateMemberRole,
  updateCommunity,
  deleteCommunity,
};
