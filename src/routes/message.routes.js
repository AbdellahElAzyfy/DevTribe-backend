const express = require("express");
const messageController = require("../controllers/message.controller");
const { authenticate } = require("../middleware/auth/authenticate");
const validateRequest = require("../middleware/validateRequest");
const messageValidators = require("../validators/message.validators");

const router = express.Router();

router.post("/", authenticate, validateRequest(messageValidators.create), messageController.create);
router.get("/", authenticate, validateRequest(messageValidators.list), messageController.listConversations);
router.get("/unread-count", authenticate, messageController.getUnreadCount);
router.get("/conversation/:userId", authenticate, validateRequest(messageValidators.getConversation), messageController.getConversation);
router.patch("/:id/read", authenticate, validateRequest(messageValidators.markRead), messageController.markAsRead);
router.patch("/conversation/:userId/read", authenticate, validateRequest(messageValidators.markConversationRead), messageController.markConversationRead);
router.delete("/:id", authenticate, validateRequest(messageValidators.delete), messageController.delete);

module.exports = router;
