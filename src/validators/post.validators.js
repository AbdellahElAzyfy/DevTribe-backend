const { z } = require("zod");

const postIdParamSchema = z.object({
  params: z.object({
    postId: z.string().trim().min(1),
  }),
});

const listPostsQuerySchema = z.object({
  query: z.object({
    communityId: z.string().trim().min(1).optional(),
    authorId: z.string().trim().min(1).optional(),
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(50).optional().default(20),
    sortBy: z.enum(["newest", "oldest", "top"]).optional().default("newest"),
    cursor: z.string().trim().optional(),
  }),
});

const feedPostsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(50).optional().default(20),
    sortBy: z.enum(["hot", "top", "newest", "oldest"]).optional().default("hot"),
    cursor: z.string().trim().optional(),
  }),
});

const listMyDraftsQuerySchema = z.object({
  query: z.object({
    communityId: z.string().trim().min(1).optional(),
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(50).optional().default(20),
  }),
});

const createPostSchema = z.object({
  body: z
    .object({
      communityId: z.string().trim().min(1).optional(),
      communitySlug: z.string().trim().min(1).optional(),
      community: z.string().trim().min(1).optional(),
      title: z.string().trim().min(5).max(300),
      content: z.string().trim().min(10).max(20000),
      tags: z.array(z.string().trim().min(1).max(30)).optional().default([]),
      isDraft: z.boolean().optional().default(false),
      isPinned: z.boolean().optional().default(false),
    })
    .refine((data) => Boolean(data.communityId || data.communitySlug || data.community), {
      message: "Community is required",
      path: ["communityId"],
    }),
});

const updatePostSchema = z.object({
  params: postIdParamSchema.shape.params,
  body: z
    .object({
      title: z.string().trim().min(5).max(300).optional(),
      content: z.string().trim().min(10).max(20000).optional(),
      tags: z.array(z.string().trim().min(1).max(30)).optional(),
      isDraft: z.boolean().optional(),
      isPinned: z.boolean().optional(),
    })
    .refine((body) => Object.keys(body).length > 0, {
      message: "At least one field is required",
    }),
});

const votePostSchema = z.object({
  params: postIdParamSchema.shape.params,
  body: z.object({
    value: z.union([z.literal(1), z.literal(-1)]),
  }),
});

module.exports = {
  postIdParamSchema,
  listPostsQuerySchema,
  feedPostsQuerySchema,
  listMyDraftsQuerySchema,
  createPostSchema,
  updatePostSchema,
  votePostSchema,
};
