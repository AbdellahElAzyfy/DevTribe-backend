const userService = require("../services/user.service");

const getByUsername = async (req, res, next) => {
  try {
    const result = await userService.getUserByUsername(req.params.username);

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const result = await userService.getUserById(req.params.userId);

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getByUsername,
  getById,
};
