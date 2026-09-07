import { z } from "zod";

const parsedSkillSchema = z.object({
  skill: z.string().trim().min(1),
  category: z.string().trim().nullable(),
});

const parsedExperienceSchema = z.object({
  company: z.string().trim().nullable(),
  title: z.string().trim().nullable(),
  startDate: z.string().trim().nullable(),
  endDate: z.string().trim().nullable(),
  isCurrent: z.boolean(),
  description: z.array(z.string()),
});

const parsedEducationSchema = z.object({
  institution: z.string().trim().nullable(),
  degree: z.string().trim().nullable(),
  field: z.string().trim().nullable(),
  startDate: z.string().trim().nullable(),
  endDate: z.string().trim().nullable(),
});

const parsedCertificationSchema = z.object({
  name: z.string().trim().min(1),
  issuer: z.string().trim().nullable(),
  date: z.string().trim().nullable(),
});

const parsedProjectSchema = z.object({
  name: z.string().trim().min(1),
  description: z.array(z.string()),
  techStack: z.array(z.string()),
});

export const updateCandidateSchema = z.object({
  fullName: z.string().trim().min(1, "fullName is required").max(200),
  email: z.string().trim().email().nullable(),
  phone: z.string().trim().nullable(),
  location: z.string().trim().nullable(),
  summary: z.string().nullable(),
  skills: z.array(parsedSkillSchema),
  experience: z.array(parsedExperienceSchema),
  education: z.array(parsedEducationSchema),
  certifications: z.array(parsedCertificationSchema),
  projects: z.array(parsedProjectSchema),
});
