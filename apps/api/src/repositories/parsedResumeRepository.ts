import { PoolClient } from "pg";
import { ParsedResume } from "@wlr/shared-types";

export async function insertParsedResumeAudit(
  client: PoolClient,
  candidateId: string,
  raw: ParsedResume
): Promise<void> {
  await client.query(
    `insert into parsed_resumes (candidate_id, raw_json, parser_version) values ($1, $2, $3)`,
    [candidateId, JSON.stringify(raw), raw.meta.parserVersion]
  );
}
