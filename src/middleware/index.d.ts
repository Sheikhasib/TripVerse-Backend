// req.user is attached by the `auth` middleware (src/middleware/auth.ts).
// The Prisma schema (Step 2) generates the Role enum used below for type safety.
import type { Role } from "../../generated/prisma/enums";

export declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        name: string;
        email: string;
        role: Role;
      };
    }
  }
}
