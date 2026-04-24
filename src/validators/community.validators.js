const { z } = require("zod");

const communitySlugParam = z.object({
  slug: z.string().trim().min(3).max(120),
});

const createCommunitySchema = z.object({
  body: z.object({
    name: z.string().trim().min(3).max(80),
    description: z.string().trim().max(500).optional().default(""),
    isPrivate: z.boolean().optional().default(false),
  }),
});

const slugParamSchema = z.object({
  params: communitySlugParam,
});

const updateMemberRoleSchema = z.object({
  params: communitySlugParam.extend({
    memberId: z.string().trim().min(1),
  }),
  body: z.object({
    role: z.enum(["moderator", "member"]),
  }),
});

module.exports = {
  createCommunitySchema,
  slugParamSchema,
  updateMemberRoleSchema,
};
