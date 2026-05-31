const express = require("express");
const userController = require("../controllers/user.controller");
const validateRequest = require("../middleware/validateRequest");
const userValidators = require("../validators/user.validators");

const router = express.Router();

router.get("/:username", validateRequest(userValidators.usernameParam), userController.getByUsername);
router.get("/id/:userId", validateRequest(userValidators.userIdParam), userController.getById);

module.exports = router;
