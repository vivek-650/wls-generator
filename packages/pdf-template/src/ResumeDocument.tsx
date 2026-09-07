import React from "react";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { Candidate, Company } from "@wlr/shared-types";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1F2937",
    paddingTop: 100,
    paddingBottom: 56,
  },
  headerBand: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  logo: {
    height: 32,
    maxWidth: 120,
    objectFit: "contain",
    marginBottom: 4,
  },
  headerCompanyName: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  body: {
    paddingHorizontal: 32,
  },
  candidateName: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: "#1F2937",
  },
  candidateRole: {
    fontSize: 11,
    color: "#4B5563",
    marginTop: 2,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginTop: 14,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    borderBottom: "1 solid #D1D5DB",
    paddingBottom: 3,
  },
  summaryText: {
    lineHeight: 1.4,
  },
  skillsTable: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  skillsHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderBottomWidth: 1,
    borderBottomColor: "#D1D5DB",
  },
  skillsRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  skillsRowLast: {
    flexDirection: "row",
  },
  skillsCategoryCell: {
    width: "30%",
    padding: 6,
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    borderRightWidth: 1,
    borderRightColor: "#D1D5DB",
  },
  skillsDetailsCell: {
    width: "70%",
    padding: 6,
    fontSize: 9,
    lineHeight: 1.4,
  },
  entry: {
    marginBottom: 8,
  },
  entryHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  entryTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
  },
  entryDates: {
    fontSize: 9,
    color: "#6B7280",
  },
  bullet: {
    flexDirection: "row",
    marginTop: 2,
    paddingLeft: 8,
  },
  bulletDot: {
    width: 8,
  },
  bulletText: {
    flex: 1,
    lineHeight: 1.35,
  },
  techStack: {
    fontSize: 8.5,
    color: "#4B5563",
    marginTop: 2,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 32,
    paddingVertical: 10,
    borderTop: "1 solid #E5E7EB",
    fontSize: 8,
    color: "#6B7280",
    textAlign: "center",
  },
});

function formatDateRange(startDate: string | null, endDate: string | null, isCurrent?: boolean): string {
  const start = startDate ?? "";
  const end = isCurrent ? "Present" : endDate ?? "";
  if (!start && !end) return "";
  return `${start} - ${end}`;
}

// The role shown under the candidate's name is their most recent job title:
// whichever experience entry is marked current, else the first entry (in
// `sortOrder`, i.e. reverse-chronological — the same convention the parser
// and the candidate editor both already use for ordering entries).
function mostRecentRole(experience: Candidate["experience"]): string | null {
  if (experience.length === 0) return null;
  const current = experience.find((e) => e.isCurrent);
  return (current ?? experience[0]).title ?? null;
}

function groupSkillsByCategory(skills: Candidate["skills"]): Array<[string, string[]]> {
  const groups = new Map<string, string[]>();
  for (const s of skills) {
    const key = s.category ?? "Skills";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s.skill);
  }
  return Array.from(groups.entries());
}

// @react-pdf/renderer's <Image> only supports raster formats (PNG/JPEG) —
// it cannot render an SVG. Logos are commonly uploaded as SVG, so request a
// PNG-rasterized delivery of the same Cloudinary asset rather than the
// stored (possibly-SVG) URL, by inserting an `f_png` transformation right
// after `/upload/` in the delivery URL. Cloudinary rasterizes on the fly;
// this only affects how the logo is fetched for the PDF, not the stored URL.
function toPdfSafeImageUrl(url: string): string {
  const marker = "/upload/";
  const idx = url.indexOf(marker);
  if (idx === -1) return url;
  const insertAt = idx + marker.length;
  return `${url.slice(0, insertAt)}f_png/${url.slice(insertAt)}`;
}

export interface ResumeDocumentProps {
  candidate: Candidate;
  company: Company;
}

export function ResumeDocument({ candidate, company }: ResumeDocumentProps): React.ReactElement {
  const skillGroups = groupSkillsByCategory(candidate.skills);
  const role = mostRecentRole(candidate.experience);

  return (
    <Document title={`${candidate.fullName} - Resume`}>
      <Page size="A4" style={styles.page}>
        <View style={[styles.headerBand, { backgroundColor: company.themeColor }]} fixed>
          {company.logoUrl ? <Image src={toPdfSafeImageUrl(company.logoUrl)} style={styles.logo} /> : null}
          <Text style={styles.headerCompanyName}>{company.companyName}</Text>
        </View>

        <View style={styles.body}>
          <Text style={styles.candidateName}>{candidate.fullName}</Text>
          {role && <Text style={styles.candidateRole}>{role}</Text>}

          {candidate.summary && (
            <View>
              <Text style={styles.sectionTitle} minPresenceAhead={40}>
                Summary
              </Text>
              <Text style={styles.summaryText}>{candidate.summary}</Text>
            </View>
          )}

          {skillGroups.length > 0 && (
            <View wrap={false}>
              <Text style={styles.sectionTitle}>Skills</Text>
              <View style={styles.skillsTable}>
                <View style={styles.skillsHeaderRow}>
                  <Text style={styles.skillsCategoryCell}>Category</Text>
                  <Text style={styles.skillsDetailsCell}>Details</Text>
                </View>
                {skillGroups.map(([category, skills], idx) => (
                  <View
                    key={category}
                    style={idx === skillGroups.length - 1 ? styles.skillsRowLast : styles.skillsRow}
                  >
                    <Text style={styles.skillsCategoryCell}>{category}</Text>
                    <Text style={styles.skillsDetailsCell}>{skills.join(", ")}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {candidate.projects.length > 0 && (
            <View>
              <Text style={styles.sectionTitle} minPresenceAhead={60}>
                Projects
              </Text>
              {candidate.projects.map((p) => (
                <View key={p.id} style={styles.entry} wrap={false}>
                  <Text style={styles.entryTitle}>{p.name}</Text>
                  {p.description.map((line, idx) => (
                    <View key={idx} style={styles.bullet}>
                      <Text style={styles.bulletDot}>-</Text>
                      <Text style={styles.bulletText}>{line}</Text>
                    </View>
                  ))}
                  {p.techStack.length > 0 && <Text style={styles.techStack}>{p.techStack.join(", ")}</Text>}
                </View>
              ))}
            </View>
          )}

          {candidate.experience.length > 0 && (
            <View>
              <Text style={styles.sectionTitle} minPresenceAhead={60}>
                Experience
              </Text>
              {candidate.experience.map((e) => (
                <View key={e.id} style={styles.entry} wrap={false}>
                  <View style={styles.entryHeaderRow}>
                    <Text style={styles.entryTitle}>{[e.title, e.company].filter(Boolean).join(" - ")}</Text>
                    <Text style={styles.entryDates}>{formatDateRange(e.startDate, e.endDate, e.isCurrent)}</Text>
                  </View>
                  {e.description.map((line, idx) => (
                    <View key={idx} style={styles.bullet}>
                      <Text style={styles.bulletDot}>-</Text>
                      <Text style={styles.bulletText}>{line}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.footer} fixed>
          {company.footerText && <Text>{company.footerText}</Text>}
          <Text>Prepared &amp; Submitted By: {company.companyName}</Text>
        </View>
      </Page>
    </Document>
  );
}
