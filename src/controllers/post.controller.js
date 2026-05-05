const postService = require("../services/post.service");
const voteService = require("../services/vote.service");
const { deleteFile } = require("../helpers/cloudinary.helpers");

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
