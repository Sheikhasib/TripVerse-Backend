import { z } from "zod";
import { BookingStatus } from "../../../generated/prisma/enums";

const createSchema = z.object({
  packageId: z.string({ required_error: "Package id is required" }).min(1),
  travelDate: z.coerce.date({
    required_error: "Travel date is required",
    invalid_type_error: "Travel date must be a valid date",
  }).refine(
    (date) => {
      const today = new Date();
      const travelDay = new Date(
        Date.UTC(
          date.getUTCFullYear(),
          date.getUTCMonth(),
          date.getUTCDate(),
        ),
      );
      const todayUTC = new Date(
        Date.UTC(
          today.getUTCFullYear(),
          today.getUTCMonth(),
          today.getUTCDate(),
        ),
      );
      return travelDay.getTime() >= todayUTC.getTime();
    },
    { message: "Travel date cannot be in the past." },
  ),
  travelers: z
    .number({ required_error: "Travelers is required" })
    .int("Travelers must be a whole number")
    .min(1, "Travelers must be at least 1")
    .max(20, "Travelers must be at most 20"),
});

const bookingParamsSchema = z.object({
  id: z.string({ required_error: "Booking id is required" }).min(1),
});

const bookingQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z.nativeEnum(BookingStatus).optional(),
});

const bookingSearchQuerySchema = bookingQuerySchema.extend({
  search: z.string().trim().optional(),
});

const updateStatusSchema = z.object({
  status: z.nativeEnum(BookingStatus, {
    required_error: "Please provide a status",
  }),
});

export type TCreateBookingSchema = z.infer<typeof createSchema>;
export type TBookingQuerySchema = z.infer<typeof bookingQuerySchema>;
export type TBookingSearchQuerySchema = z.infer<typeof bookingSearchQuerySchema>;
export type TUpdateStatusSchema = z.infer<typeof updateStatusSchema>;

export const bookingValidations = {
  createSchema,
  bookingParamsSchema,
  bookingQuerySchema,
  bookingSearchQuerySchema,
  updateStatusSchema,
};