const { z } = require("zod");

const usernameParam = z.object({
  params: z.object({
    // Must accept any username that registration allows (auth.validators.js
    // only enforces trim + length), so usernames with spaces resolve correctly.
    username: z
      .string()
      .trim()
      .min(3, "Username must be at least 3 characters")
      .max(30, "Username must be at most 30 characters"),
  }),
});

const userIdParam = z.object({
  params: z.object({
    userId: z.string().min(1, "User ID is required"),
  }),
});

module.exports = {
  usernameParam,
  userIdParam,
};
