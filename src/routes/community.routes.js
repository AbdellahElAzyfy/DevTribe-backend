const express = require("express");

const communityController = require("../controllers/community.controller");
const authenticate = require("../middleware/auth/authenticate");
const validateRequest = require("../middleware/validateRequest");
const {
  createCommunitySchema,
  slugParamSchema,
  updateMemberRoleSchema,
} = require("../validators/community.validators");

const router = express.Router();

router.get("/", communityController.list);
router.post("/", authenticate, validateRequest(createCommunitySchema), communityController.create);
router.get("/:slug", validateRequest(slugParamSchema), communityController.getBySlug);
router.post(
  "/:slug/join",
  authenticate,
  validateRequest(slugParamSchema),
  communityController.join
);
router.post(
  "/:slug/leave",
  authenticate,
  validateRequest(slugParamSchema),
  communityController.leave
);
router.patch(
  "/:slug/members/:memberId/role",
  authenticate,
  validateRequest(updateMemberRoleSchema),
  communityController.updateRole
);
router.delete("/:slug", authenticate, validateRequest(slugParamSchema), communityController.remove);

module.exports = router;
