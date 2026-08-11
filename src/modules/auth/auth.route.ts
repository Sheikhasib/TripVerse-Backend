import { Router } from "express";
import { authController } from "./auth.controller";
import { authValidations } from "./auth.validation";
import validateRequest from "../../middleware/validateRequest";
import auth from "../../middleware/auth";

const router = Router();

// Register — role is optional and restricted to USER/AGENT in the service
router.post(
  "/register",
  validateRequest({ body: authValidations.registerSchema }),
  authController.registerUser,
);

router.post(
  "/login",
  validateRequest({ body: authValidations.loginSchema }),
  authController.loginUser,
);

router.post(
  "/google",
  validateRequest({ body: authValidations.googleLoginSchema }),
  authController.googleLogin,
);

router.post(
  "/demo-login",
  validateRequest({ body: authValidations.demoLoginSchema }),
  authController.demoLogin,
);

router.post(
  "/refresh",
  validateRequest({ body: authValidations.refreshTokenSchema }),
  authController.refreshToken,
);

router.post("/logout", auth(), authController.logoutUser);

router.get("/me", auth(), authController.getMe);

export const authRoutes = router;