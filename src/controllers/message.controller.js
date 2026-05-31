const messageService = require("../services/message.service");
const notificationService = require("../services/notification.service");
const { emitToUser } = require("../sockets/socketEmitter");

const toIdString = (value) => (value ? value.toString() : null);

const create = async (req, res, next) => {
  try {
    const message = await messageService.createMessage({
      senderId: req.user.id,
      recipientId: req.body.recipientId,
      content: req.body.content,
    });

    const recipientId = toIdString(message.recipient._id ?? message.recipient);
    const senderId = toIdString(message.sender._id ?? message.sender);

    emitToUser(recipientId, "message:created", { message });
    emitToUser(senderId, "message:created", { message });

    if (recipientId && recipientId !== senderId) {
      (async () => {
        try {
          const notification = await notificationService.createNotification({
            userId: recipientId,
            actorId: senderId,
            type: "direct_message",
            data: {
              messageId: toIdString(message.id ?? message._id),
              messageSnippet: message.content.slice(0, 100),
              senderId: senderId,
              senderUsername: message.sender.username,
            },
          });
          emitToUser(recipientId, "notification:created", notification);
        } catch (err) {
          console.error("Failed to create notification for message:", err.message || err);
        }
      })();
    }

    return res.status(201).json({
      message: "Message sent successfully",
      data: message,
    });
  } catch (error) {
    return next(error);
  }
};

const listConversations = async (req, res, next) => {
  try {
    const result = await messageService.listConversations(req.user.id, req.validated.query);

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

const getConversation = async (req, res, next) => {
  try {
    const result = await messageService.getConversation(
      req.user.id,
      req.validated.params.userId,
      req.validated.query
    );

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

const markAsRead = async (req, res, next) => {
  try {
    const message = await messageService.markAsRead(req.validated.params.id, req.user.id);

    const senderId = toIdString(message.sender._id ?? message.sender);
    const recipientId = toIdString(message.recipient._id ?? message.recipient);

    emitToUser(senderId, "message:read", {
      messageId: toIdString(message.id ?? message._id),
      conversationUserId: recipientId,
    });

    return res.status(200).json({
      message: "Message marked as read",
      data: message,
    });
  } catch (error) {
    return next(error);
  }
};

const markConversationRead = async (req, res, next) => {
  try {
    const result = await messageService.markConversationRead(
      req.user.id,
      req.validated.params.userId
    );

    emitToUser(req.validated.params.userId, "message:conversation_read", {
      conversationUserId: toIdString(req.user.id),
    });

    return res.status(200).json({
      message: "Conversation marked as read",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const deleteMessage = async (req, res, next) => {
  try {
    const message = await messageService.deleteMessage(req.validated.params.id, req.user.id);

    const recipientId = toIdString(message.recipient._id ?? message.recipient);
    const senderId = toIdString(message.sender._id ?? message.sender);
    const messageId = toIdString(message.id ?? message._id);

    emitToUser(recipientId, "message:deleted", {
      messageId,
      conversationUserId: senderId,
    });
    emitToUser(senderId, "message:deleted", {
      messageId,
      conversationUserId: recipientId,
    });

    return res.status(200).json({
      message: "Message deleted successfully",
    });
  } catch (error) {
    return next(error);
  }
};

const getUnreadCount = async (req, res, next) => {
  try {
    const result = await messageService.getUnreadCount(req.user.id);

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  create,
  listConversations,
  getConversation,
  markAsRead,
  markConversationRead,
  delete: deleteMessage,
  getUnreadCount,
};
