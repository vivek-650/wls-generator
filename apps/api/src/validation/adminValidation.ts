import { z } from "zod";

export const updateCompanyStatusSchema = z.object({
  status: z.enum(["active", "inactive"]),
});
