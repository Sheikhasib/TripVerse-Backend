import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import auth from "../../middleware/auth";
import validateRequest from "../../middleware/validateRequest";
import { userController } from "./user.controller";
import { userValidations } from "./user.validation";

const router = Router();

// Own profile — any authenticated user
router.patch(
  "/profile",
  auth(),
  validateRequest({ body: userValidations.updateProfileSchema }),
  userController.updateProfile,
);

// Admin — list users with filters + pagination
router.get(
  "/",
  auth(Role.ADMIN),
  validateRequest({ query: userValidations.userQuerySchema }),
  userController.getUsers,
);

// Admin — role management
router.patch(
  "/:id/role",
  auth(Role.ADMIN),
  validateRequest({
    params: userValidations.userParamsSchema,
    body: userValidations.changeRoleSchema,
  }),
  userController.changeRole,
);

// Admin — status management
router.patch(
  "/:id/status",
  auth(Role.ADMIN),
  validateRequest({
    params: userValidations.userParamsSchema,
    body: userValidations.changeStatusSchema,
  }),
  userController.changeStatus,
);

// Admin — soft delete
router.delete(
  "/:id",
  auth(Role.ADMIN),
  validateRequest({ params: userValidations.userParamsSchema }),
  userController.deleteUser,
);

export const userRoutes = router;