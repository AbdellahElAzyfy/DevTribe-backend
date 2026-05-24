let ioInstance = null;

const setSocketServer = (io) => {
  ioInstance = io;
};

const getSocketServer = () => ioInstance;

const emitToRoom = (room, event, payload) => {
  if (!ioInstance || !room) {
    return false;
  }

  ioInstance.to(room).emit(event, payload);
  return true;
};

const emitToUser = (userId, event, payload) => {
  return emitToRoom(userId ? `user:${userId}` : null, event, payload);
};

const emitToCommunity = (communityId, event, payload) => {
  return emitToRoom(communityId ? `community:${communityId}` : null, event, payload);
};

module.exports = {
  setSocketServer,
  getSocketServer,
  emitToRoom,
  emitToUser,
  emitToCommunity,
};
