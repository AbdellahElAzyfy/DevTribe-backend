const { z } = require("zod");

const searchQuery = z.object({
  query: z.object({
    q: z.string().trim().min(1, "Search query is required").max(100, "Search query is too long"),
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(50).optional().default(20),
  }),
});

const searchAllQuery = z.object({
  query: z.object({
    q: z.string().trim().min(1, "Search query is required").max(100, "Search query is too long"),
  }),
});

module.exports = {
  searchQuery,
  searchAllQuery,
};
