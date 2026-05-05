const express = require("express");

const communityController = require("../controllers/community.controller");
const { authenticate, optionalAuthenticate } = require("../middleware/auth/authenticate");
const validateRequest = require("../middleware/validateRequest");
const {
  createCommunitySchema,
  slugParamSchema,
  updateMemberRoleSchema,
  updateCommunitySchema,
} = require("../validators/community.validators");

const router = express.Router();

router.get("/", optionalAuthenticate, communityController.list);
router.post("/", authenticate, validateRequest(createCommunitySchema), communityController.create);
router.patch("/:slug", authenticate, validateRequest(updateCommunitySchema), communityController.update);
router.get("/:slug", optionalAuthenticate, validateRequest(slugParamSchema), communityController.getBySlug);
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
