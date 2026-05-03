const { z } = require("zod");

const registerSchema = z.object({
  body: z.object({
    username: z.string().trim().min(3).max(30),
    email: z.string().trim().email(),
    password: z.string().min(8).max(128),
  }),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().email(),
    password: z.string().min(1),
  }),
});

const updateProfileSchema = z.object({
  body: z.object({
    username: z.string().trim().min(3).max(30).optional(),
    email: z.string().trim().email().optional(),
    bio: z.string().trim().max(160).optional(),
  }).refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  }),
});

const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).max(128),
    confirmPassword: z.string().min(8).max(128),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  }),
});

module.exports = {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
};
