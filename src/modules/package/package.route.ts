import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import auth from "../../middleware/auth";
import validateRequest from "../../middleware/validateRequest";
import { packageController } from "./package.controller";
import { packageValidations } from "./package.validation";

const router = Router();

// NOTE: `/internal/*` routes MUST stay registered before `GET /:slug` below —
// Express matches top-down, and a literal segment (`/internal/all`) would
// otherwise be swallowed by the `:slug` param route and 404 forever.

// 1. My packages (agent) — self-preview of PENDING/REJECTED before approval
router.get(
  "/internal/my-packages",
  auth(Role.AGENT),
  validateRequest({ query: packageValidations.internalPackageQuerySchema }),
  packageController.getMyPackages,
);

// 2. All packages (admin moderation UI)
router.get(
  "/internal/all",
  auth(Role.ADMIN),
  validateRequest({ query: packageValidations.internalPackageQuerySchema }),
  packageController.getAllPackages,
);

// 3. Public package detail by slug
router.get(
  "/:slug",
  validateRequest({ params: packageValidations.packageSlugParamsSchema }),
  packageController.getPackageBySlug,
);

// 4. Create package (agent creates own; admin can create for any agent)
router.post(
  "/",
  auth(Role.AGENT, Role.ADMIN),
  validateRequest({ body: packageValidations.createPackageSchema }),
  packageController.createPackage,
);

// 5. Approve/reject package (admin) — registered before PATCH /:id for clarity
router.patch(
  "/:id/status",
  auth(Role.ADMIN),
  validateRequest({
    params: packageValidations.packageParamsSchema,
    body: packageValidations.updateStatusSchema,
  }),
  packageController.changePackageStatus,
);

// 6. Update package (agent own / admin any)
router.patch(
  "/:id",
  auth(Role.AGENT, Role.ADMIN),
  validateRequest({
    params: packageValidations.packageParamsSchema,
    body: packageValidations.updatePackageSchema,
  }),
  packageController.updatePackage,
);

// 7. Soft delete package (agent own / admin any)
router.delete(
  "/:id",
  auth(Role.AGENT, Role.ADMIN),
  validateRequest({ params: packageValidations.packageParamsSchema }),
  packageController.softDeletePackage,
);

// 8. Public listing — kept last so none of the above routes are shadowed
router.get(
  "/",
  validateRequest({ query: packageValidations.packageQuerySchema }),
  packageController.getPublicPackages,
);

export const packageRoutes = router;