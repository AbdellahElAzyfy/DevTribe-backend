const Message = require("../models/Message");
const User = require("../models/User");

const buildPagination = (page = 1, limit = 20) => {
  const p = Number(page) || 1;
  const l = Math.min(Number(limit) || 20, 100);
  return { page: p, limit: l };
};

const USER_FIELDS = "username avatar role";

const isValidObjectId = (id) => {
  return id && /^[0-9a-fA-F]{24}$/.test(id.toString());
};

const toPublicMessage = (message) => {
  if (!message) return null;

  return {
    id: message._id ?? message.id,
    sender: message.sender,
    recipient: message.recipient,
    content: message.content,
    isRead: message.isRead,
    readAt: message.readAt,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };
};

const createMessage = async ({ senderId, recipientId, content }) => {
  if (!isValidObjectId(senderId)) {
    const error = new Error("Invalid sender id");
    error.statusCode = 400;
    throw error;
  }

  if (!isValidObjectId(recipientId)) {
    const error = new Error("Invalid recipient id");
    error.statusCode = 400;
    throw error;
  }

  if (senderId.toString() === recipientId.toString()) {
    const error = new Error("Cannot send message to yourself");
    error.statusCode = 400;
    throw error;
  }

  const trimmedContent = typeof content === "string" ? content.trim() : "";
  if (!trimmedContent) {
    const error = new Error("Message content is required");
    error.statusCode = 400;
    throw error;
  }

  const [sender, recipient] = await Promise.all([
    User.findById(senderId).select("_id"),
    User.findById(recipientId).select("_id"),
  ]);

  if (!sender) {
    const error = new Error("Sender not found");
    error.statusCode = 404;
    throw error;
  }

  if (!recipient) {
    const error = new Error("Recipient not found");
    error.statusCode = 404;
    throw error;
  }

  const message = await Message.create({
    sender: senderId,
    recipient: recipientId,
    content: trimmedContent,
  });

  const populatedMessage = await Message.findById(message._id)
    .populate("sender", USER_FIELDS)
    .populate("recipient", USER_FIELDS)
    .lean();

  return toPublicMessage(populatedMessage);
};

const listConversations = async (userId, { page = 1, limit = 20 } = {}) => {
  if (!isValidObjectId(userId)) {
    const error = new Error("Invalid user id");
    error.statusCode = 400;
    throw error;
  }

  const pagination = buildPagination(page, limit);

  const conversations = await Message.aggregate([
    {
      $match: {
        $or: [{ sender: userId }, { recipient: userId }],
      },
    },
    {
      $sort: { createdAt: -1 },
    },
    {
      $group: {
        _id: {
          $cond: [
            { $eq: ["$sender", userId] },
            "$recipient",
            "$sender",
          ],
        },
        lastMessage: { $first: "$$ROOT" },
        unreadCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$recipient", userId] },
                  { $eq: ["$isRead", false] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
    {
      $sort: { "lastMessage.createdAt": -1 },
    },
    {
      $skip: (pagination.page - 1) * pagination.limit,
    },
    {
      $limit: pagination.limit,
    },
  ]);

  const userIds = conversations.map((conv) => conv._id);
  const users = await User.find({ _id: { $in: userIds } })
    .select(USER_FIELDS)
    .lean();

  const userMap = new Map(users.map((u) => [u._id.toString(), u]));

  const result = conversations.map((conv) => {
    const user = userMap.get(conv._id.toString());
    return {
      user: user
        ? {
            _id: user._id,
            username: user.username,
            avatar: user.avatar,
            role: user.role,
          }
        : null,
      lastMessage: {
        _id: conv.lastMessage._id,
        content: conv.lastMessage.content,
        createdAt: conv.lastMessage.createdAt,
        sender: conv.lastMessage.sender,
        recipient: conv.lastMessage.recipient,
      },
      unreadCount: conv.unreadCount,
    };
  });

  return {
    conversations: result.filter((c) => c.user !== null),
    page: pagination.page,
    limit: pagination.limit,
  };
};

const getConversation = async (userId, otherUserId, { page = 1, limit = 50 } = {}) => {
  if (!isValidObjectId(userId)) {
    const error = new Error("Invalid user id");
    error.statusCode = 400;
    throw error;
  }

  if (!isValidObjectId(otherUserId)) {
    const error = new Error("Invalid other user id");
    error.statusCode = 400;
    throw error;
  }

  if (userId.toString() === otherUserId.toString()) {
    const error = new Error("Cannot view conversation with yourself");
    error.statusCode = 400;
    throw error;
  }

  const pagination = buildPagination(page, limit);
  const skip = (pagination.page - 1) * pagination.limit;

  const [messages, total, otherUser] = await Promise.all([
    Message.find({
      $or: [
        { sender: userId, recipient: otherUserId },
        { sender: otherUserId, recipient: userId },
      ],
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pagination.limit)
      .populate("sender", USER_FIELDS)
      .populate("recipient", USER_FIELDS)
      .lean(),
    Message.countDocuments({
      $or: [
        { sender: userId, recipient: otherUserId },
        { sender: otherUserId, recipient: userId },
      ],
    }),
    User.findById(otherUserId).select(USER_FIELDS).lean(),
  ]);

  if (!otherUser) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  return {
    messages: messages.reverse().map(toPublicMessage),
    otherUser: {
      _id: otherUser._id,
      username: otherUser.username,
      avatar: otherUser.avatar,
      role: otherUser.role,
    },
    page: pagination.page,
    limit: pagination.limit,
    total,
    totalPages: Math.ceil(total / pagination.limit),
  };
};

const markAsRead = async (messageId, userId) => {
  if (!isValidObjectId(messageId)) {
    const error = new Error("Invalid message id");
    error.statusCode = 400;
    throw error;
  }

  const message = await Message.findOneAndUpdate(
    { _id: messageId, recipient: userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } },
    { new: true }
  )
    .populate("sender", USER_FIELDS)
    .populate("recipient", USER_FIELDS);

  if (!message) {
    const error = new Error("Message not found or already read");
    error.statusCode = 404;
    throw error;
  }

  return toPublicMessage(message);
};

const markConversationRead = async (userId, otherUserId) => {
  if (!isValidObjectId(userId)) {
    const error = new Error("Invalid user id");
    error.statusCode = 400;
    throw error;
  }

  if (!isValidObjectId(otherUserId)) {
    const error = new Error("Invalid other user id");
    error.statusCode = 400;
    throw error;
  }

  const result = await Message.updateMany(
    { sender: otherUserId, recipient: userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );

  return { modifiedCount: result.modifiedCount };
};

const deleteMessage = async (messageId, userId) => {
  if (!isValidObjectId(messageId)) {
    const error = new Error("Invalid message id");
    error.statusCode = 400;
    throw error;
  }

  const message = await Message.findOneAndDelete({
    _id: messageId,
    sender: userId,
  });

  if (!message) {
    const error = new Error("Message not found or you are not the sender");
    error.statusCode = 404;
    throw error;
  }

  return toPublicMessage(message);
};

const getUnreadCount = async (userId) => {
  if (!isValidObjectId(userId)) {
    const error = new Error("Invalid user id");
    error.statusCode = 400;
    throw error;
  }

  const count = await Message.countDocuments({
    recipient: userId,
    isRead: false,
  });

  return { count };
};

module.exports = {
  createMessage,
  listConversations,
  getConversation,
  markAsRead,
  markConversationRead,
  deleteMessage,
  getUnreadCount,
};
