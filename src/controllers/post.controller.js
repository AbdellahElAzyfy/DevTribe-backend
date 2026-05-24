const postService = require("../services/post.service");
const voteService = require("../services/vote.service");
const { deleteFile } = require("../helpers/cloudinary.helpers");
const { emitToCommunity, emitToUser } = require("../sockets/socketEmitter");
const notificationService = require("../services/notification.service");
const Post = require("../models/Post");
const Community = require("../models/Community");

const toIdString = (value) => (value ? value.toString() : null);

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
    emitToCommunity(toIdString(communityId), "post:created", {
      post,
      actorId: toIdString(req.user.id),
    });

    // Fan out a notification to every community member except the actor.
    // Skipped for drafts. Fire-and-forget — failures must not block the response.
    if (!post.isDraft && communityId) {
      (async () => {
        try {
          const community = await Community.findById(communityId)
            .select("members slug name")
            .lean();
          const actorId = toIdString(req.user.id);
          const recipients = (community?.members ?? [])
            .map((m) => m.user?.toString())
            .filter((id) => id && id !== actorId);

          await Promise.all(
            recipients.map(async (recipient) => {
              const notification = await notificationService.createNotification({
                userId: recipient,
                actorId: req.user.id,
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
      })();
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
};
