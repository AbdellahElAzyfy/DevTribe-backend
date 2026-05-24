const express = require("express");
const { authenticate } = require("../middleware/auth/authenticate");
const validateRequest = require("../middleware/validateRequest");
const notificationController = require("../controllers/notification.controller");
const {
  listNotificationsSchema,
  notificationIdParam,
} = require("../validators/notification.validators");

const router = express.Router();

router.use(authenticate);

router.get("/", validateRequest(listNotificationsSchema), notificationController.list);
router.patch("/:id/read", validateRequest(notificationIdParam), notificationController.markRead);
router.patch("/read-all", notificationController.markAll);

module.exports = router;
