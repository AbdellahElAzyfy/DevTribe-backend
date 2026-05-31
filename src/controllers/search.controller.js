const searchService = require("../services/search.service");

const all = async (req, res, next) => {
  try {
    const { q } = req.validated.query;
    const result = await searchService.searchAll(q, req.user ?? null);
    return res.status(200).json({ q, ...result });
  } catch (error) {
    return next(error);
  }
};

const posts = async (req, res, next) => {
  try {
    const { q, page, limit } = req.validated.query;
    const result = await searchService.searchPosts(q, { page, limit }, req.user ?? null);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

const communities = async (req, res, next) => {
  try {
    const { q, page, limit } = req.validated.query;
    const result = await searchService.searchCommunities(q, { page, limit }, req.user ?? null);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

const users = async (req, res, next) => {
  try {
    const { q, page, limit } = req.validated.query;
    const result = await searchService.searchUsers(q, { page, limit });
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  all,
  posts,
  communities,
  users,
};
