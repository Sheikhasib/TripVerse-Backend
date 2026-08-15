import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import auth from "../../middleware/auth";
import validateRequest from "../../middleware/validateRequest";
import { wishlistController } from "./wishlist.controller";
import { wishlistValidations } from "./wishlist.validation";

const router = Router();

// 1. Save a package to the wishlist (USER only)
router.post(
  "/",
  auth(Role.USER),
  validateRequest({ body: wishlistValidations.createWishlistSchema }),
  wishlistController.addToWishlist,
);

// 2. My wishlist (USER only) — paginated, newest first
router.get(
  "/",
  auth(Role.USER),
  validateRequest({ query: wishlistValidations.wishlistQuerySchema }),
  wishlistController.getMyWishlist,
);

// 3. Remove a package from the wishlist (USER only)
router.delete(
  "/:packageId",
  auth(Role.USER),
  validateRequest({ params: wishlistValidations.wishlistParamsSchema }),
  wishlistController.removeFromWishlist,
);

export const wishlistRoutes = router;