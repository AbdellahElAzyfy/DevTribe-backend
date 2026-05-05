const express = require("express");
const authController = require("../controllers/auth.controller");
const validateRequest = require("../middleware/validateRequest");
const { authenticate } = require("../middleware/auth/authenticate");
const authorizeRoles = require("../middleware/auth/authorizeRoles");
const { uploadAvatar } = require("../middleware/uploadFile");
const {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
} = require("../validators/auth.validators");

const router = express.Router();

router.post("/register", validateRequest(registerSchema), authController.register);
router.post("/login", validateRequest(loginSchema), authController.login);
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);
router.get("/me", authenticate, authController.me);
router.patch(
  "/me",
  authenticate,
  uploadAvatar,
  validateRequest(updateProfileSchema),
  authController.updateProfile
);
router.patch(
  "/me/password",
  authenticate,
  validateRequest(changePasswordSchema),
  authController.changePassword
);
router.get("/admin-check", authenticate, authorizeRoles("admin"), (req, res) => {
  res.json({ message: "Admin access granted" });
});

module.exports = router;
