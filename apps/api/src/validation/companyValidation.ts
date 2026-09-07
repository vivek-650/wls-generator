import { z } from "zod";

export const updateBrandingSchema = z.object({
  companyName: z.string().trim().min(1, "companyName is required").max(200),
  themeColor: z
    .string()
    .trim()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "themeColor must be a hex color, e.g. #1E1B4B"),
  footerText: z.string().trim().max(500).nullable(),
});

export const createCompanyUserSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(200),
  email: z.string().trim().email("must be a valid email"),
  password: z.string().min(8, "password must be at least 8 characters").max(200),
});
