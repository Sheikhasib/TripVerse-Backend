import { NextFunction, Request, Response } from "express";
import { ZodType } from "zod";

type ValidationSchema = {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
};

// Runs Zod schemas against req.body/query/params and replaces the parsed
// values so downstream handlers work with validated (and typed) data.
// Any ZodError thrown here is mapped to a 400 by globalErrorHandler.
//
// req.body is safely writable, but in Express 5 req.query/req.params are
// getter-only — they must be redefined via defineProperty to swap in the
// parsed values.
const validateRequest = (schema: ValidationSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (schema.body) {
      req.body = schema.body.parse(req.body);
    }
    if (schema.query) {
      const parsedQuery = schema.query.parse(req.query);
      Object.defineProperty(req, "query", {
        value: parsedQuery,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }
    if (schema.params) {
      const parsedParams = schema.params.parse(req.params);
      Object.defineProperty(req, "params", {
        value: parsedParams,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }

    next();
  };
};

export default validateRequest;