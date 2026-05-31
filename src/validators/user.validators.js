const { z } = require("zod");

const usernameParam = z.object({
  params: z.object({
    username: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(30, "Username must be at most 30 characters")
      .regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, underscores, and dashes"),
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
