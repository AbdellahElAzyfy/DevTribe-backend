const express = require("express");

const postController = require("../controllers/post.controller");
const authenticate = require("../middleware/auth/authenticate");
const validateRequest = require("../middleware/validateRequest");
const uploadFile = require("../middleware/uploadFile");
const {
  listPostsQuerySchema,
  listMyDraftsQuerySchema,
  createPostSchema,
  postIdParamSchema,
  updatePostSchema,
  votePostSchema,
} = require("../validators/post.validators");

const router = express.Router();

router.get(
  "/me/drafts",
  authenticate,
  validateRequest(listMyDraftsQuerySchema),
  postController.listMyDrafts
);
router.get("/", validateRequest(listPostsQuerySchema), postController.list);
router.post(
  "/",
  authenticate,
  uploadFile.single("image"),
  validateRequest(createPostSchema),
  postController.create
);
router.get("/:postId", validateRequest(postIdParamSchema), postController.getById);
router.patch(
  "/:postId",
  authenticate,
  uploadFile.single("image"),
  validateRequest(updatePostSchema),
  postController.update
);
router.delete("/:postId", authenticate, validateRequest(postIdParamSchema), postController.remove);
router.post("/:postId/vote", authenticate, validateRequest(votePostSchema), postController.vote);

module.exports = router;
