import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import auth from "../../middleware/auth";
import validateRequest from "../../middleware/validateRequest";
import { categoryController } from "./category.controller";
import { categoryValidations } from "./category.validation";

const router = Router();

// 1. List all categories (public, no auth)
router.get("/", categoryController.getAllCategories);

// 2. Create category (admin)
router.post(
  "/",
  auth(Role.ADMIN),
  validateRequest({ body: categoryValidations.createCategorySchema }),
  categoryController.createCategory,
);

// 3. Update category (admin)
router.patch(
  "/:id",
  auth(Role.ADMIN),
  validateRequest({
    params: categoryValidations.categoryParamsSchema,
    body: categoryValidations.updateCategorySchema,
  }),
  categoryController.updateCategory,
);

// 4. Delete category (admin)
router.delete(
  "/:id",
  auth(Role.ADMIN),
  validateRequest({ params: categoryValidations.categoryParamsSchema }),
  categoryController.deleteCategory,
);

export const categoryRoutes = router;