import { UserRole } from "@wlr/shared-types";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        companyId: string | null;
        role: UserRole;
      };
    }
  }
}

export {};
