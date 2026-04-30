const { z } = require("zod");

const postIdParamSchema = z.object({
  params: z.object({
    postId: z.string().trim().min(1),
  }),
});

const commentIdParamSchema = z.object({
  params: z.object({
    commentId: z.string().trim().min(1),
  }),
});

const listCommentsSchema = z.object({
  params: postIdParamSchema.shape.params,
  query: z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(50).optional().default(20),
  }),
});

const createCommentSchema = z.object({
  params: postIdParamSchema.shape.params,
  body: z.object({
    content: z.string().trim().min(1).max(3000),
    parentCommentId: z.string().trim().optional().default(null),
  }),
});

const updateCommentSchema = z.object({
  params: commentIdParamSchema.shape.params,
  body: z.object({
    content: z.string().trim().min(1).max(3000),
  }),
});

const voteCommentSchema = z.object({
  params: commentIdParamSchema.shape.params,
  body: z.object({
    value: z.union([z.literal(1), z.literal(-1)]),
  }),
});

module.exports = {
  postIdParamSchema,
  commentIdParamSchema,
  listCommentsSchema,
  createCommentSchema,
  updateCommentSchema,
  voteCommentSchema,
};
