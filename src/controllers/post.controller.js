const postService = require("../services/post.service");
const voteService = require("../services/vote.service");

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

const create = async (req, res, next) => {
  try {
    const payload = {
      ...req.body,
      image: req.file?.secure_url || null,
    };

    const post = await postService.createPost(payload, req.user);

    return res.status(201).json({
      message: "Post created successfully",
      post,
    });
  } catch (error) {
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
      payload.image = req.file.secure_url;
    }

    const post = await postService.updatePost(req.validated.params.postId, payload, req.user);

    return res.status(200).json({
      message: "Post updated successfully",
      post,
    });
  } catch (error) {
    return next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    await postService.deletePost(req.validated.params.postId, req.user);

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

    return res.status(200).json({
      message: "Post vote recorded",
      vote,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  list,
  listMyDrafts,
  create,
  getById,
  update,
  remove,
  vote,
};
