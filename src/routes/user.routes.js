const express = require("express");
const userController = require("../controllers/user.controller");
const { optionalAuthenticate } = require("../middleware/auth/authenticate");
const validateRequest = require("../middleware/validateRequest");
const userValidators = require("../validators/user.validators");

const router = express.Router();

router.get(
  "/:username",
  optionalAuthenticate,
  validateRequest(userValidators.usernameParam),
  userController.getByUsername
);
router.get(
  "/id/:userId",
  optionalAuthenticate,
  validateRequest(userValidators.userIdParam),
  userController.getById
);

module.exports = router;
