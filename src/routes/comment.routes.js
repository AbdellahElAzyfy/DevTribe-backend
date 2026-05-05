const express = require("express");

const commentController = require("../controllers/comment.controller");
const { authenticate } = require("../middleware/auth/authenticate");
const validateRequest = require("../middleware/validateRequest");
const {
  listCommentsSchema,
  createCommentSchema,
  commentIdParamSchema,
  updateCommentSchema,
  voteCommentSchema,
} = require("../validators/comment.validators");

const router = express.Router();

router.get("/post/:postId", validateRequest(listCommentsSchema), commentController.listByPost);
router.post(
  "/post/:postId",
  authenticate,
  validateRequest(createCommentSchema),
  commentController.create
);
router.patch(
  "/:commentId",
  authenticate,
  validateRequest(updateCommentSchema),
  commentController.update
);
router.delete(
  "/:commentId",
  authenticate,
  validateRequest(commentIdParamSchema),
  commentController.remove
);
router.post(
  "/:commentId/vote",
  authenticate,
  validateRequest(voteCommentSchema),
  commentController.vote
);

module.exports = router;
