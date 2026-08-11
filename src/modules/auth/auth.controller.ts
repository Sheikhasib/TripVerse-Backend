import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { authService } from "./auth.service";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";

const isProduction = process.env.NODE_ENV === "production";

// Dev (localhost:3000 → :4000) is same-site → lax works with secure:false.
// Prod (cross-site frontend/backend) requires SameSite=None + Secure.
const cookieOptions: {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax" | "none";
} = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
};

const ACCESS_COOKIE_MAX_AGE = 24 * 60 * 60 * 1000; // 1 day
const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

const setAuthCookies = (
  res: Response,
  { accessToken, refreshToken }: { accessToken: string; refreshToken: string },
) => {
  res.cookie("accessToken", accessToken, {
    ...cookieOptions,
    maxAge: ACCESS_COOKIE_MAX_AGE,
  });
  res.cookie("refreshToken", refreshToken, {
    ...cookieOptions,
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });
};

const clearAuthCookies = (res: Response) => {
  res.clearCookie("accessToken", cookieOptions);
  res.clearCookie("refreshToken", cookieOptions);
};

// Register controller
const registerUser = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const user = await authService.registerUser(req.body);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.CREATED,
      message: "User Registered successfully.",
      data: user,
    });
  },
);

// Login controller
const loginUser = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { accessToken, refreshToken } = await authService.loginUser(req.body);

    setAuthCookies(res, { accessToken, refreshToken });

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "User logged in successfully",
      data: { accessToken, refreshToken },
    });
  },
);

// Google login (ID-token flow)
const googleLogin = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { accessToken, refreshToken, user } = await authService.googleLogin(
      req.body,
    );

    setAuthCookies(res, { accessToken, refreshToken });

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "User logged in successfully",
      data: { accessToken, refreshToken, user },
    });
  },
);

// Demo login controller
const demoLogin = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { accessToken, refreshToken, user } = await authService.demoLogin(
      req.body,
    );

    setAuthCookies(res, { accessToken, refreshToken });

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Demo user logged in successfully",
      data: { accessToken, refreshToken, user },
    });
  },
);

// Refresh token controller
const refreshToken = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const refreshTokenFromCookie = req.cookies.refreshToken;
    const refreshTokenFromBody = req.body?.refreshToken;

    if (!refreshTokenFromCookie && !refreshTokenFromBody) {
      return sendResponse(res, {
        success: false,
        statusCode: httpStatus.UNAUTHORIZED,
        message: "Refresh token is required",
        data: null,
      });
    }

    const { accessToken, refreshToken: newRefreshToken } =
      await authService.refreshToken({
        refreshToken: refreshTokenFromCookie || refreshTokenFromBody,
      });

    setAuthCookies(res, {
      accessToken,
      refreshToken: newRefreshToken,
    });

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Token refreshed successfully",
      data: { accessToken, refreshToken: newRefreshToken },
    });
  },
);

// Logout controller
const logoutUser = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id as string;

    await authService.logout(userId);
    clearAuthCookies(res);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "User logged out successfully",
      data: null,
    });
  },
);

// Get Me controller
const getMe = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id as string;

    const user = await authService.getMeFromDB(userId);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "User fetched successfully.",
      data: user,
    });
  },
);

export const authController = {
  registerUser,
  loginUser,
  googleLogin,
  demoLogin,
  refreshToken,
  logoutUser,
  getMe,
};