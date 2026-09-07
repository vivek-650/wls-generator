import { ParsedResume } from "@wlr/shared-types";

export const SAMPLE_PARSED_RESUME: ParsedResume = {
  contact: {
    fullName: "Jamie Rivera",
    email: "jamie.rivera@example.com",
    phone: "+1-555-0134",
    location: "Austin, TX",
  },
  summary: "Senior iOS engineer with 8 years building consumer mobile apps.",
  skills: [
    { skill: "Swift", category: "Languages & Frameworks" },
    { skill: "UIKit", category: "Languages & Frameworks" },
    { skill: "Leadership", category: "Soft Skills" },
  ],
  experience: [
    {
      company: "Acme Mobile",
      title: "Senior iOS Engineer",
      startDate: "2023-08",
      endDate: null,
      isCurrent: true,
      description: ["Led migration to SwiftUI", "Mentored 3 junior engineers"],
    },
  ],
  education: [
    {
      institution: "University of Texas",
      degree: "B.S.",
      field: "Computer Science",
      startDate: "2012-08",
      endDate: "2016-05",
    },
  ],
  certifications: [{ name: "AWS Certified Developer", issuer: "AWS", date: "2021-04" }],
  projects: [
    {
      name: "OpenTrail",
      description: ["Open source hiking trail tracker"],
      techStack: ["Swift", "CoreLocation"],
    },
  ],
  meta: { parserVersion: "test-0.0.1", sourceFileType: "pdf", warnings: [] },
};

export async function parseResume(): Promise<ParsedResume> {
  return SAMPLE_PARSED_RESUME;
}
