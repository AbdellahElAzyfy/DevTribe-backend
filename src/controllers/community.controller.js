const communityService = require("../services/community.service");

const list = async (req, res, next) => {
  try {
    const communities = await communityService.listCommunities();

    return res.status(200).json({
      communities,
    });
  } catch (error) {
    return next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const community = await communityService.createCommunity(req.validated.body, req.user.id);

    return res.status(201).json({
      message: "Community created successfully",
      community,
    });
  } catch (error) {
    return next(error);
  }
};

const getBySlug = async (req, res, next) => {
  try {
    const community = await communityService.getCommunity(req.validated.params.slug);

    return res.status(200).json({
      community,
    });
  } catch (error) {
    return next(error);
  }
};

const join = async (req, res, next) => {
  try {
    const community = await communityService.joinCommunity(req.validated.params.slug, req.user.id);

    return res.status(200).json({
      message: "Joined community",
      community,
    });
  } catch (error) {
    return next(error);
  }
};

const leave = async (req, res, next) => {
  try {
    const community = await communityService.leaveCommunity(req.validated.params.slug, req.user.id);

    return res.status(200).json({
      message: "Left community",
      community,
    });
  } catch (error) {
    return next(error);
  }
};

const updateRole = async (req, res, next) => {
  try {
    const community = await communityService.updateMemberRole(
      req.validated.params.slug,
      req.validated.params.memberId,
      req.validated.body.role,
      req.user
    );

    return res.status(200).json({
      message: "Member role updated",
      community,
    });
  } catch (error) {
    return next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    await communityService.deleteCommunity(req.validated.params.slug, req.user);

    return res.status(200).json({
      message: "Community deleted",
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  list,
  create,
  getBySlug,
  join,
  leave,
  updateRole,
  remove,
};
