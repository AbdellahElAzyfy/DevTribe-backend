const Post = require("../models/Post");
const Comment = require("../models/Comment");
const Vote = require("../models/Vote");
const {
  findPostContext,
  findCommentContext,
  ensureCanViewPost,
} = require("../helpers/post.helpers");

const adjustVoteCount = async (targetType, targetId, delta) => {
  const Model = targetType === "post" ? Post : Comment;
  await Model.updateOne({ _id: targetId }, { $inc: { voteCount: delta } });
};

const loadTargetContext = async (targetType, targetId) => {
  if (targetType === "post") {
    const { post, community } = await findPostContext(targetId);
    return { target: post, post, community };
  }

  if (targetType === "comment") {
    const { comment, post, community } = await findCommentContext(targetId);
    return { target: comment, post, community };
  }

  const error = new Error("Unsupported vote target");
  error.statusCode = 400;
  throw error;
};

const castVote = async ({ targetType, targetId, value }, actor) => {
  const normalizedTargetType = String(targetType || "").trim();
  const normalizedValue = Number(value);

  if (!["post", "comment"].includes(normalizedTargetType)) {
    const error = new Error("Unsupported vote target");
    error.statusCode = 400;
    throw error;
  }

  if (![1, -1].includes(normalizedValue)) {
    const error = new Error("Vote value must be 1 or -1");
    error.statusCode = 400;
    throw error;
  }

  const { target, post, community } = await loadTargetContext(normalizedTargetType, targetId);
  ensureCanViewPost(post, community, actor);

  const existingVote = await Vote.findOne({
    targetType: normalizedTargetType,
    targetId: target._id,
    user: actor.id,
  });

  let voteCount = target.voteCount ?? 0;

  if (existingVote && existingVote.value === normalizedValue) {
    await Vote.deleteOne({ _id: existingVote._id });
    await adjustVoteCount(normalizedTargetType, target._id, -normalizedValue);
    voteCount -= normalizedValue;

    return {
      targetType: normalizedTargetType,
      targetId: target._id,
      postId: post?._id,
      communityId: community?._id,
      value: 0,
      voteCount,
      action: "removed",
    };
  }

  if (existingVote) {
    const delta = normalizedValue - existingVote.value;
    existingVote.value = normalizedValue;
    await existingVote.save();
    await adjustVoteCount(normalizedTargetType, target._id, delta);
    voteCount += delta;

    return {
      targetType: normalizedTargetType,
      targetId: target._id,
      postId: post?._id,
      communityId: community?._id,
      value: normalizedValue,
      voteCount,
      action: "updated",
    };
  }

  await Vote.create({
    targetType: normalizedTargetType,
    targetId: target._id,
    user: actor.id,
    value: normalizedValue,
  });

  await adjustVoteCount(normalizedTargetType, target._id, normalizedValue);
  voteCount += normalizedValue;

  return {
    targetType: normalizedTargetType,
    targetId: target._id,
    postId: post?._id,
    communityId: community?._id,
    value: normalizedValue,
    voteCount,
    action: "created",
  };
};

const getVotesForTargets = async (targetType, targetIds, userId) => {
  if (!userId || !targetIds.length) return {};

  const votes = await Vote.find({
    targetType,
    targetId: { $in: targetIds },
    user: userId,
  });

  return votes.reduce((acc, vote) => {
    acc[vote.targetId.toString()] = vote.value;
    return acc;
  }, {});
};

module.exports = {
  castVote,
  getVotesForTargets,
};
