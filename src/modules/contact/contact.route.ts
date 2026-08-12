import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import auth from "../../middleware/auth";
import validateRequest from "../../middleware/validateRequest";
import { contactController } from "./contact.controller";
import { contactValidations } from "./contact.validation";

const router = Router();

// 1. Create contact message route (public, no auth)
router.post(
  "/",
  validateRequest({ body: contactValidations.createMessageSchema }),
  contactController.createMessage,
);

// 2. List contact messages route (admin only)
router.get(
  "/",
  auth(Role.ADMIN),
  validateRequest({ query: contactValidations.contactQuerySchema }),
  contactController.getMessages,
);

// 3. Mark resolved/unresolved route (admin only)
router.patch(
  "/:id",
  auth(Role.ADMIN),
  validateRequest({
    params: contactValidations.contactParamsSchema,
    body: contactValidations.updateResolvedSchema,
  }),
  contactController.updateResolved,
);

export const contactRoutes = router;