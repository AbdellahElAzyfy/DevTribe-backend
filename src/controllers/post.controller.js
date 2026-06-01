const postService = require("../services/post.service");
const voteService = require("../services/vote.service");
const { deleteFile } = require("../helpers/cloudinary.helpers");
const { emitToCommunity, emitToUser } = require("../sockets/socketEmitter");
const notificationService = require("../services/notification.service");
const Post = require("../models/Post");
const Community = require("../models/Community");
const User = require("../models/User");

const toIdString = (value) => (value ? value.toString() : null);

const notifyCommunityOfNewPost = async (post, actorUser) => {
  try {
    const communityId = post.community?.id ?? post.community?._id;
    if (!communityId) return;

    const community = await Community.findById(communityId)
      .select("members slug name")
      .lean();
    const actorId = toIdString(actorUser.id);
    const recipients = (community?.members ?? [])
      .map((m) => m.user?.toString())
      .filter((id) => id && id !== actorId);

    await Promise.all(
      recipients.map(async (recipient) => {
        const notification = await notificationService.createNotification({
          userId: recipient,
          actorId: actorUser.id,
          type: "community_post",
          data: {
            postId: toIdString(post.id ?? post._id),
            postTitle: post.title,
            communitySlug: community.slug,
            communityName: community.name,
          },
        });
        emitToUser(recipient, "notification:created", notification);
      })
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Failed to fan out community-post notifications:", err.message || err);
  }
};

const notifyModeratorsOfPendingPost = async (post, actorUser) => {
  try {
    const communityId = post.community?.id ?? post.community?._id;
    if (!communityId) return;

    const community = await Community.findById(communityId)
      .select("members slug name")
      .lean();

    const actorId = toIdString(actorUser.id);

    const moderatorIds = (community?.members ?? [])
      .filter((m) => m.role === "owner" || m.role === "moderator")
      .map((m) => m.user?.toString())
      .filter((id) => id && id !== actorId);

    const globalAdmins = await User.find({
      role: "admin",
      _id: { $ne: actorUser.id },
    }).select("_id");
    const adminIds = globalAdmins.map((u) => u._id.toString());

    const recipients = Array.from(new Set([...moderatorIds, ...adminIds]));
    const snippet = typeof post.content === "string" ? post.content.slice(0, 140) : "";

    await Promise.all(
      recipients.map(async (recipient) => {
        const notification = await notificationService.createNotification({
          userId: recipient,
          actorId: actorUser.id,
          type: "post_pending_moderation",
          data: {
            postId: toIdString(post.id ?? post._id),
            postTitle: post.title,
            communityId: toIdString(communityId),
            communitySlug: community?.slug,
            communityName: community?.name,
            snippet,
          },
        });
        emitToUser(recipient, "notification:created", notification);
      })
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Failed to fan out moderation notifications:", err.message || err);
  }
};

const list = async (req, res, next) => {
  try {
    const result = await postService.listPosts(req.validated.query, req.user ?? null);

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

const listMyDrafts = async (req, res, next) => {
  try {
    const result = await postService.listMyDrafts(req.validated.query, req.user);

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

const feed = async (req, res, next) => {
  try {
    const result = await postService.getFeed(req.validated.query, req.user);

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

const create = async (req, res, next) => {
  try {
    let imageUrl = req.file?.path;
    if (req.file && !req.file.path.startsWith("http")) {
      const normalizedPath = req.file.path.replace(/\\/g, "/");
      const uploadsIndex = normalizedPath.indexOf("/uploads/");
      if (uploadsIndex !== -1) {
        imageUrl = normalizedPath.substring(uploadsIndex);
      }
    }

    const payload = {
      ...req.body,
      image: imageUrl,
    };

    const post = await postService.createPost(payload, req.user);

    const communityId = post.community?.id ?? post.community?._id;

    if (post.isDraft) {
      // Drafts don't broadcast or notify anyone.
    } else if (post.isApproved) {
      emitToCommunity(toIdString(communityId), "post:created", {
        post,
        actorId: toIdString(req.user.id),
      });
      // Fire-and-forget — failures must not block the response.
      notifyCommunityOfNewPost(post, req.user);
    } else {
      // Pending moderation — only mods/admins get notified.
      notifyModeratorsOfPendingPost(post, req.user);
    }

    return res.status(201).json({
      message: "Post created successfully",
      post,
    });
  } catch (error) {
    if (req.file) {
      await deleteFile(req.file);
    }
    return next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const post = await postService.getPost(req.validated.params.postId, req.user ?? null);

    return res.status(200).json({ post });
  } catch (error) {
    return next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const payload = {
      ...req.body,
    };

    if (req.file) {
      let imageUrl = req.file.path;
      if (!req.file.path.startsWith("http")) {
        const normalizedPath = req.file.path.replace(/\\/g, "/");
        const uploadsIndex = normalizedPath.indexOf("/uploads/");
        if (uploadsIndex !== -1) {
          imageUrl = normalizedPath.substring(uploadsIndex);
        }
      }
      payload.image = imageUrl;
    }

    const post = await postService.updatePost(req.validated.params.postId, payload, req.user);

    const communityId = post.community?.id ?? post.community?._id;
    emitToCommunity(toIdString(communityId), "post:updated", {
      post,
      actorId: toIdString(req.user.id),
    });

    return res.status(200).json({
      message: "Post updated successfully",
      post,
    });
  } catch (error) {
    if (req.file) {
      await deleteFile(req.file);
    }
    return next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const post = await postService.deletePost(req.validated.params.postId, req.user);

    const communityId = post.community?.id ?? post.community?._id ?? post.community;
    emitToCommunity(toIdString(communityId), "post:deleted", {
      postId: post.id ?? post._id,
      communityId: toIdString(communityId),
      actorId: toIdString(req.user.id),
    });
    emitToUser(toIdString(post.author?.id ?? post.author?._id ?? post.author), "post:deleted", {
      postId: post.id ?? post._id,
      communityId: toIdString(communityId),
      actorId: toIdString(req.user.id),
    });

    return res.status(200).json({
      message: "Post deleted successfully",
    });
  } catch (error) {
    return next(error);
  }
};

const vote = async (req, res, next) => {
  try {
    const vote = await voteService.castVote(
      {
        targetType: "post",
        targetId: req.validated.params.postId,
        value: req.validated.body.value,
      },
      req.user
    );

    emitToCommunity(toIdString(vote.communityId), "post:voted", {
      vote: {
        ...vote,
        targetId: toIdString(vote.targetId),
        postId: toIdString(vote.postId),
        communityId: toIdString(vote.communityId),
      },
      actorId: toIdString(req.user.id),
    });

    // Notify post author
    try {
      const postDoc = await Post.findById(vote.postId).select("author title").lean();
      const recipient = postDoc?.author ? postDoc.author.toString() : null;
      if (recipient && recipient !== toIdString(req.user.id)) {
        const notification = await notificationService.createNotification({
          userId: recipient,
          actorId: req.user.id,
          type: "post_vote",
          data: {
            postId: vote.postId.toString(),
            postTitle: postDoc.title,
            voteId: vote._id?.toString() ?? null,
            value: vote.value,
          },
        });
        emitToUser(recipient, "notification:created", notification);
      }
    } catch (err) {
      // non-fatal
      // eslint-disable-next-line no-console
      console.error("Failed to create notification for post vote:", err.message || err);
    }

    return res.status(200).json({
      message: "Post vote recorded",
      vote,
    });
  } catch (error) {
    return next(error);
  }
};

const toggleSave = async (req, res, next) => {
  try {
    const result = await postService.toggleSave(req.validated.params.postId, req.user.id);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

const listSaved = async (req, res, next) => {
  try {
    const posts = await postService.listSavedPosts(req.user.id);
    return res.status(200).json({ posts });
  } catch (error) {
    return next(error);
  }
};

const listPending = async (req, res, next) => {
  try {
    const identifier = req.params.identifier;
    const result = await postService.listPendingPosts(identifier, req.user);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

const approve = async (req, res, next) => {
  try {
    const post = await postService.approvePost(req.params.postId, req.user);
    const communityId = post.community?.id ?? post.community?._id;

    const authorActor = {
      id: toIdString(post.author?.id ?? post.author?._id ?? post.author),
    };

    emitToCommunity(toIdString(communityId), "post:created", {
      post,
      actorId: authorActor.id,
    });

    // Fan out the standard community_post notification to all members,
    // attributed to the post's author — not the moderator approving it.
    if (authorActor.id) {
      notifyCommunityOfNewPost(post, authorActor);
    }

    // Notify the post author that their post was approved.
    try {
      const authorId = toIdString(post.author?.id ?? post.author?._id);
      const actorId = toIdString(req.user.id);
      if (authorId && authorId !== actorId) {
        const notification = await notificationService.createNotification({
          userId: authorId,
          actorId: req.user.id,
          type: "post_approved",
          data: {
            postId: toIdString(post.id ?? post._id),
            postTitle: post.title,
            communityId: toIdString(communityId),
            communitySlug: post.community?.slug,
            communityName: post.community?.name,
          },
        });
        emitToUser(authorId, "notification:created", notification);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Failed to notify author of post approval:", err.message || err);
    }

    return res.status(200).json({
      message: "Post approved",
      post,
    });
  } catch (error) {
    return next(error);
  }
};

const decline = async (req, res, next) => {
  try {
    const post = await postService.declinePost(req.params.postId, req.user);
    const communityId = post.community?.id ?? post.community?._id ?? post.community;

    emitToCommunity(toIdString(communityId), "post:deleted", {
      postId: post.id ?? post._id,
      communityId: toIdString(communityId),
      actorId: toIdString(req.user.id),
    });

    return res.status(200).json({
      message: "Post declined",
      postId: post.id ?? post._id,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  list,
  feed,
  listMyDrafts,
  create,
  getById,
  update,
  remove,
  vote,
  toggleSave,
  listSaved,
  listPending,
  approve,
  decline,
};
