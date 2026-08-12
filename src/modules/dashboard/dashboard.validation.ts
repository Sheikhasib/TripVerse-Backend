import { z } from "zod";

const dashboardQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export const dashboardValidations = {
  dashboardQuerySchema,
};