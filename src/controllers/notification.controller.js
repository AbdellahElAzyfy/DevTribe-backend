const notificationService = require("../services/notification.service");
const { emitToUser } = require("../sockets/socketEmitter");

const list = async (req, res, next) => {
  try {
    const result = await notificationService.listNotifications(req.user.id, req.validated.query);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

const markRead = async (req, res, next) => {
  try {
    const notification = await notificationService.markAsRead(req.validated.params.id, req.user.id);
    emitToUser(req.user.id, "notification:updated", notification);
    return res.status(200).json({ notification });
  } catch (error) {
    return next(error);
  }
};

const markAll = async (req, res, next) => {
  try {
    await notificationService.markAllRead(req.user.id);
    emitToUser(req.user.id, "notification:all_read", { userId: req.user.id });
    return res.status(200).json({ success: true });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  list,
  markRead,
  markAll,
};
