const Community = require("../../models/Community");

const joinUserRooms = async (socket) => {
  try {
    if (!socket?.user?.id) return;

    const communities = await Community.find({ "members.user": socket.user.id }).select("_id").lean();
    communities.forEach((c) => socket.join(`community:${c._id.toString()}`));
  } catch (err) {
    console.error(`Failed to join community rooms for user ${socket.user?.id}:`, err.message);
  }
};

module.exports = joinUserRooms;
