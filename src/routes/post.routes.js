const express = require("express");

const postController = require("../controllers/post.controller");
const { authenticate, optionalAuthenticate } = require("../middleware/auth/authenticate");
const validateRequest = require("../middleware/validateRequest");
const { uploadFile } = require("../middleware/uploadFile");
const {
	listPostsQuerySchema,
	feedPostsQuerySchema,
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
router.get("/feed", authenticate, validateRequest(feedPostsQuerySchema), postController.feed);
router.get("/", optionalAuthenticate, validateRequest(listPostsQuerySchema), postController.list);
router.post(
	"/",
	authenticate,
	uploadFile,
	validateRequest(createPostSchema),
	postController.create
);
router.get("/saved", authenticate, postController.listSaved);
router.get("/community/:identifier/pending", authenticate, postController.listPending);
router.patch("/:postId/approve", authenticate, validateRequest(postIdParamSchema), postController.approve);
router.delete("/:postId/decline", authenticate, validateRequest(postIdParamSchema), postController.decline);
router.get("/:postId", optionalAuthenticate, validateRequest(postIdParamSchema), postController.getById);
router.patch(
	"/:postId",
	authenticate,
	uploadFile,
	validateRequest(updatePostSchema),
	postController.update
);
router.delete("/:postId", authenticate, validateRequest(postIdParamSchema), postController.remove);
router.post("/:postId/vote", authenticate, validateRequest(votePostSchema), postController.vote);
router.post(
  "/:postId/save",
  authenticate,
  validateRequest(postIdParamSchema),
  postController.toggleSave
);

module.exports = router;
