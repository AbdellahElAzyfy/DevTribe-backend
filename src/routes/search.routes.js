const express = require("express");
const searchController = require("../controllers/search.controller");
const { optionalAuthenticate } = require("../middleware/auth/authenticate");
const validateRequest = require("../middleware/validateRequest");
const searchValidators = require("../validators/search.validators");

const router = express.Router();

router.get(
  "/",
  optionalAuthenticate,
  validateRequest(searchValidators.searchAllQuery),
  searchController.all
);

router.get(
  "/posts",
  optionalAuthenticate,
  validateRequest(searchValidators.searchQuery),
  searchController.posts
);

router.get(
  "/communities",
  optionalAuthenticate,
  validateRequest(searchValidators.searchQuery),
  searchController.communities
);

router.get(
  "/users",
  optionalAuthenticate,
  validateRequest(searchValidators.searchQuery),
  searchController.users
);

module.exports = router;
