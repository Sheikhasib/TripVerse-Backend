import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import multer from "multer";
import { ZodError } from "zod";
import { Prisma } from "../../generated/prisma/client";
import config from "../config";
import { AppError } from "../utils/appError";

const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (config.node_env !== "production") {
    console.error("Error:", err);
  }

  // default fallback
  let statusCode: number = httpStatus.INTERNAL_SERVER_ERROR;
  let errorMessage: string = err?.message || "Internal Server Error";
  let errorName: string = err?.name || "Error";

  // Body-parser errors (malformed JSON, payload too large, bad charset...) carry
  // a 4xx status — they are the client's fault, not a server failure.
  if (
    !(err instanceof AppError) &&
    typeof err?.status === "number" &&
    err.status >= 400 &&
    err.status < 500
  ) {
    statusCode = err.status;
    errorName = "BadRequestError";
    errorMessage =
      err.type === "entity.parse.failed"
        ? "Malformed JSON in request body."
        : err.type === "entity.too.large"
          ? "Request body is too large."
          : "The request could not be processed.";
  }

  // Zod validation error
  else if (err instanceof ZodError) {
    statusCode = httpStatus.BAD_REQUEST;
    errorMessage = err.issues.map((i) => i.message).join(", ");
    errorName = "ZodError";
  }

  // Multer file upload error
  else if (err instanceof multer.MulterError) {
    statusCode = httpStatus.BAD_REQUEST;
    errorName = "MulterError";
    errorMessage =
      err.code === "LIMIT_FILE_SIZE"
        ? "File too large. Maximum size is 5MB."
        : `Upload failed: ${err.code}`;
  }

  // Custom file type rejection from the multer fileFilter
  else if (err instanceof Error && (err as any).code === "INVALID_FILE_TYPE") {
    statusCode = httpStatus.BAD_REQUEST;
    errorMessage = err.message;
  }

  // Prisma validation error
  else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = httpStatus.BAD_REQUEST;
    errorMessage =
      "You have provided incorrect field type or missing required fields";
    errorName = "PrismaClientValidationError";
  }

  // Prisma known errors
  else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    errorName = "PrismaClientKnownRequestError";

    if (err.code === "P2002") {
      statusCode = httpStatus.CONFLICT;
      errorMessage = "This value already exists";
    } else if (err.code === "P2003") {
      statusCode = httpStatus.CONFLICT;
      errorMessage = "Foreign key constraint failed";
    } else if (err.code === "P2025") {
      statusCode = httpStatus.NOT_FOUND;
      errorMessage =
        "An operation failed because one or more required records were not found.";
    } else {
      // never echo a raw Prisma message to the client
      statusCode = httpStatus.BAD_REQUEST;
      errorMessage = "The request could not be processed.";
    }
  }

  // Prisma DB connection/init error
  else if (err instanceof Prisma.PrismaClientInitializationError) {
    errorName = "PrismaClientInitializationError";

    if (err.errorCode === "P1000") {
      statusCode = httpStatus.UNAUTHORIZED;
      errorMessage =
        "Authentication failed against the database server. Please check your database credentials.";
    } else if (err.errorCode === "P1001") {
      statusCode = httpStatus.SERVICE_UNAVAILABLE;
      errorMessage = "Can't reach the database server.";
    } else {
      statusCode = httpStatus.INTERNAL_SERVER_ERROR;
      errorMessage = "Internal Server Error";
    }
  }

  // Prisma unknown request error
  else if (err instanceof Prisma.PrismaClientUnknownRequestError) {
    statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    errorName = "PrismaClientUnknownRequestError";
    errorMessage = "Error occurred during query execution";
  }

  // Your custom AppError
  else if (err instanceof AppError) {
    statusCode = err.statusCode;
    errorMessage = err.message;
    errorName = err.name || "AppError";
  }

  // Fallback for other thrown errors
  else if (err instanceof Error) {
    statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    errorMessage = err.message || "Internal Server Error";
    errorName = err.name || "Error";
  }

  // Internal details (driver errors, stack-derived messages) never reach
  // clients in production — a 5xx says only "Internal Server Error".
  if (statusCode >= 500 && config.is_production) {
    errorMessage = "Internal Server Error";
    errorName = "Error";
  }

  res.status(statusCode).json({
    success: false,
    statusCode,
    name: errorName,
    message: errorMessage,
    error: config.node_env === "development" ? err.stack : undefined,
  });
};

export default globalErrorHandler;
