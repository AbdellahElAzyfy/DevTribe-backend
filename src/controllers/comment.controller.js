const commentService = require("../services/comment.service");
const voteService = require("../services/vote.service");

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
    await commentService.deleteComment(req.validated.params.commentId, req.user);

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
