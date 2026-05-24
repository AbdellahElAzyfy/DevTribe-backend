const { z } = require("zod");

const listNotificationsSchema = z.object({
  query: z.object({
    page: z.preprocess((v) => Number(v), z.number().int().positive().optional()),
    limit: z.preprocess((v) => Number(v), z.number().int().positive().optional()),
  }),
});

const notificationIdParam = z.object({ params: z.object({ id: z.string().min(1) }) });

module.exports = { listNotificationsSchema, notificationIdParam };
