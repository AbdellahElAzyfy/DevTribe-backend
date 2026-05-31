const commentService = require("../services/comment.service");
const voteService = require("../services/vote.service");
const Post = require("../models/Post");
const Comment = require("../models/Comment");
const notificationService = require("../services/notification.service");
const { emitToCommunity, emitToUser } = require("../sockets/socketEmitter");

const toIdString = (value) => (value ? value.toString() : null);

const findCommunityIdByPostId = async (postId) => {
  const post = await Post.findById(postId).select("community").lean();
  return post?.community ? post.community.toString() : null;
};

const listByPost = async (req, res, next) => {
  try {
    const result = await commentService.listComments(
      req.validated.params.postId,
      req.user ?? null,
      req.validated.query
    );

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const comment = await commentService.createComment(
      req.validated.params.postId,
      req.validated.body,
      req.user
    );

    const communityId = await findCommunityIdByPostId(comment.post);
    emitToCommunity(communityId, "comment:created", {
      comment,
      communityId,
      actorId: toIdString(req.user.id),
    });

    const actorIdStr = toIdString(req.user.id);
    const commentIdStr = toIdString(comment.id ?? comment._id);
    const postIdStr = toIdString(comment.post);
    const commentSnippet =
      typeof comment.content === "string" ? comment.content.slice(0, 140) : "";

    // Notify post author (if not the actor)
    try {
      const postDoc = await Post.findById(comment.post).select("author title").lean();
      const postAuthorId = postDoc?.author ? postDoc.author.toString() : null;
      if (postAuthorId && postAuthorId !== actorIdStr) {
        const notification = await notificationService.createNotification({
          userId: postAuthorId,
          actorId: req.user.id,
          type: "comment",
          data: {
            postId: postIdStr,
            postTitle: postDoc.title,
            commentId: commentIdStr,
            commentSnippet,
          },
        });
        emitToUser(postAuthorId, "notification:created", notification);
      }

      // Notify parent comment author on reply (if not the actor and not the post author)
      const parentCommentId = toIdString(comment.parentComment);
      if (parentCommentId) {
        const parentComment = await Comment.findById(parentCommentId)
          .select("author content")
          .lean();
        const parentAuthorId = parentComment?.author ? parentComment.author.toString() : null;
        if (
          parentAuthorId &&
          parentAuthorId !== actorIdStr &&
          parentAuthorId !== postAuthorId
        ) {
          const notification = await notificationService.createNotification({
            userId: parentAuthorId,
            actorId: req.user.id,
            type: "comment_reply",
            data: {
              postId: postIdStr,
              postTitle: postDoc?.title,
              commentId: commentIdStr,
              parentCommentId,
              parentCommentSnippet:
                typeof parentComment?.content === "string"
                  ? parentComment.content.slice(0, 140)
                  : "",
              commentSnippet,
            },
          });
          emitToUser(parentAuthorId, "notification:created", notification);
        }
      }
    } catch (err) {
      // non-fatal: don't block comment creation on notification failure
      // eslint-disable-next-line no-console
      console.error("Failed to create notification for comment:", err.message || err);
    }

    return res.status(201).json({
      message: "Comment created successfully",
      comment,
    });
  } catch (error) {
    return next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const comment = await commentService.updateComment(
      req.validated.params.commentId,
      req.validated.body,
      req.user
    );

    const communityId = await findCommunityIdByPostId(comment.post);
    emitToCommunity(communityId, "comment:updated", {
      comment,
      communityId,
      actorId: toIdString(req.user.id),
    });

    return res.status(200).json({
      message: "Comment updated successfully",
      comment,
    });
  } catch (error) {
    return next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const comment = await commentService.deleteComment(req.validated.params.commentId, req.user);

    const communityId = await findCommunityIdByPostId(comment.post);
    emitToCommunity(communityId, "comment:deleted", {
      commentId: comment.id ?? comment._id,
      postId: toIdString(comment.post),
      parentCommentId: toIdString(comment.parentComment),
      communityId,
      actorId: toIdString(req.user.id),
    });

    return res.status(200).json({
      message: "Comment deleted successfully",
    });
  } catch (error) {
    return next(error);
  }
};

const vote = async (req, res, next) => {
  try {
    const vote = await voteService.castVote(
      {
        targetType: "comment",
        targetId: req.validated.params.commentId,
        value: req.validated.body.value,
      },
      req.user
    );

    emitToCommunity(toIdString(vote.communityId), "comment:voted", {
      vote: {
        ...vote,
        targetId: toIdString(vote.targetId),
        postId: toIdString(vote.postId),
        communityId: toIdString(vote.communityId),
      },
      actorId: toIdString(req.user.id),
    });

    // Notify comment author about vote
    try {
      const commentDoc = await Comment.findById(req.validated.params.commentId)
        .select("author post content")
        .lean();
      const recipient = commentDoc?.author ? commentDoc.author.toString() : null;
      if (recipient && recipient !== toIdString(req.user.id)) {
        const postDoc = commentDoc.post
          ? await Post.findById(commentDoc.post).select("title").lean()
          : null;
        const notification = await notificationService.createNotification({
          userId: recipient,
          actorId: req.user.id,
          type: "comment_vote",
          data: {
            commentId: req.validated.params.commentId,
            postId: commentDoc.post?.toString(),
            postTitle: postDoc?.title,
            commentSnippet:
              typeof commentDoc.content === "string" ? commentDoc.content.slice(0, 140) : "",
            value: vote.value,
          },
        });
        emitToUser(recipient, "notification:created", notification);
      }
    } catch (err) {
      // non-fatal
      // eslint-disable-next-line no-console
      console.error("Failed to create notification for comment vote:", err.message || err);
    }

    return res.status(200).json({
      message: "Comment vote recorded",
      vote,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listByPost,
  create,
  update,
  remove,
  vote,
};
