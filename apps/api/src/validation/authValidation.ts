import { z } from "zod";

export const registerSchema = z.object({
  companyName: z.string().trim().min(1, "companyName is required").max(200),
  name: z.string().trim().min(1, "name is required").max(200),
  email: z.string().trim().email("must be a valid email"),
  password: z.string().min(8, "password must be at least 8 characters").max(200),
});

export const loginSchema = z.object({
  email: z.string().trim().email("must be a valid email"),
  password: z.string().min(1, "password is required"),
});
