const { z } = require("zod");

const create = z.object({
  body: z.object({
    recipientId: z.string().min(1, "Recipient ID is required"),
    content: z.string().min(1, "Content is required").max(2000, "Content must be 2000 characters or less").trim(),
  }),
});

const list = z.object({
  query: z.object({
    page: z.preprocess((v) => Number(v), z.number().int().positive().optional()),
    limit: z.preprocess((v) => Number(v), z.number().int().positive().optional()),
  }),
});

const getConversation = z.object({
  params: z.object({
    userId: z.string().min(1, "User ID is required"),
  }),
  query: z.object({
    page: z.preprocess((v) => Number(v), z.number().int().positive().optional()),
    limit: z.preprocess((v) => Number(v), z.number().int().positive().optional()),
  }),
});

const markRead = z.object({
  params: z.object({
    id: z.string().min(1, "Message ID is required"),
  }),
});

const markConversationRead = z.object({
  params: z.object({
    userId: z.string().min(1, "User ID is required"),
  }),
});

const deleteMessage = z.object({
  params: z.object({
    id: z.string().min(1, "Message ID is required"),
  }),
});

module.exports = {
  create,
  list,
  getConversation,
  markRead,
  markConversationRead,
  delete: deleteMessage,
};
