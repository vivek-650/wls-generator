import { ParsedResume } from "@wlr/shared-types";
import { env } from "../config/env";
import { AppError } from "../errors/AppError";

export interface ParseFileInput {
  buffer: Buffer;
  filename: string;
  mimetype: string;
}

/**
 * Forwards a resume file to the Python parser service (services/parser,
 * internal-only). Uses Node 22's native fetch/FormData/Blob — no extra
 * multipart client library needed.
 */
export async function parseResume(input: ParseFileInput): Promise<ParsedResume> {
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(input.buffer)], { type: input.mimetype });
  formData.append("file", blob, input.filename);

  let response: Response;
  try {
    response = await fetch(`${env.parserServiceUrl}/parse`, {
      method: "POST",
      body: formData,
    });
  } catch (err) {
    throw AppError.internal(`Could not reach parser service: ${(err as Error).message}`, "PARSER_UNREACHABLE");
  }

  if (response.status === 422) {
    let message = "The uploaded file could not be parsed as a resume";
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      if (body?.error?.message) message = body.error.message;
    } catch {
      // ignore — fall back to default message
    }
    throw AppError.unprocessable(message, "UNPARSEABLE_FILE");
  }

  if (!response.ok) {
    throw AppError.internal(`Parser service returned ${response.status}`, "PARSER_ERROR");
  }

  return (await response.json()) as ParsedResume;
}
