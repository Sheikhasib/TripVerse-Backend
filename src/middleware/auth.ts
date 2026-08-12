import { NextFunction, Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { Role } from "../../generated/prisma/enums";
import config from "../config";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/appError";
import { catchAsync } from "../utils/catchAsync";
import { jwtUtils } from "../utils/jwt";

// auth(Role.AGENT, Role.ADMIN) → only those roles pass
// auth() → any authenticated user passes
const auth = (...requiredRoles: Role[]) => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies.accessToken
      ? req.cookies.accessToken
      : req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.split(" ")[1]
        : req.headers.authorization;

    // 1. token must be present
    if (!token) {
      throw new AppError(
        401,
        "You are not logged in. Please login to continue.",
      );
    }

    // 2. verify the access token
    const verifiedToken = jwtUtils.verifyToken(
      token,
      config.jwt_access_secret,
    );

    if (!verifiedToken.success) {
      throw new AppError(401, verifiedToken.error);
    }

    const { id, tokenVersion } = verifiedToken.data as JwtPayload & {
      tokenVersion: number;
    };

    // 3. re-fetch user to enforce account state on every request
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user || user.isDeleted) {
      throw new AppError(401, "User not found.");
    }

    if (user.status === "SUSPENDED") {
      throw new AppError(
        403,
        "User is suspended. Please contact support service.",
      );
    }

    // 4. tokenVersion must match DB (logout / password change kills old tokens)
    if (user.tokenVersion !== tokenVersion) {
      throw new AppError(
        401,
        "Session is no longer valid. Please login again.",
      );
    }

    // 5. authorization uses the DB role, not the (possibly stale) JWT role
    if (requiredRoles.length && !requiredRoles.includes(user.role)) {
      throw new AppError(
        403,
        "You are not authorized to access this route.",
      );
    }

    // 6. attach the authenticated user to the request
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    next();
  });
};

export default auth;