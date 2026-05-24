const Notification = require("../models/Notification");

const buildPagination = (page = 1, limit = 20) => {
  const p = Number(page) || 1;
  const l = Math.min(Number(limit) || 20, 100);
  return { page: p, limit: l };
};

const ACTOR_FIELDS = "username avatar role";

const createNotification = async ({ userId, actorId = null, type, data = {} }) => {
  const notification = await Notification.create({
    user: userId,
    actor: actorId,
    type,
    data,
  });

  return Notification.findById(notification._id)
    .populate("actor", ACTOR_FIELDS)
    .lean();
};

const listNotifications = async (userId, { page = 1, limit = 20 } = {}) => {
  const pagination = buildPagination(page, limit);
  const skip = (pagination.page - 1) * pagination.limit;

  const [notifications, total] = await Promise.all([
    Notification.find({ user: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pagination.limit)
      .populate("actor", ACTOR_FIELDS)
      .lean(),
    Notification.countDocuments({ user: userId }),
  ]);

  return {
    notifications,
    page: pagination.page,
    limit: pagination.limit,
    total,
    totalPages: Math.ceil(total / pagination.limit),
  };
};

const markAsRead = async (notificationId, userId) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, user: userId },
    { $set: { isRead: true } },
    { new: true }
  ).populate("actor", ACTOR_FIELDS);

  if (!notification) {
    const error = new Error("Notification not found");
    error.statusCode = 404;
    throw error;
  }

  return notification;
};

const markAllRead = async (userId) => {
  await Notification.updateMany({ user: userId, isRead: false }, { $set: { isRead: true } });
  return true;
};

module.exports = {
  createNotification,
  listNotifications,
  markAsRead,
  markAllRead,
};
