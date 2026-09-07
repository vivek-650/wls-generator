import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

// NODE_ENV=test relies on tests/setup.ts to populate process.env before this
// module is imported, so `required()` still fails fast for real boot paths.
export const env = {
  nodeEnv: optional("NODE_ENV", "development"),
  port: parseInt(optional("PORT", "4000"), 10),
  frontendUrl: optional("FRONTEND_URL", "http://localhost:3000"),

  databaseUrl: required("DATABASE_URL"),

  jwtSecret: required("JWT_SECRET"),
  jwtAccessTtl: optional("JWT_ACCESS_TTL", "15m"),
  refreshTokenTtlDays: parseInt(optional("REFRESH_TOKEN_TTL_DAYS", "30"), 10),

  cloudinaryCloudName: optional("CLOUDINARY_CLOUD_NAME", ""),
  cloudinaryApiKey: optional("CLOUDINARY_API_KEY", ""),
  cloudinaryApiSecret: optional("CLOUDINARY_API_SECRET", ""),

  parserServiceUrl: optional("PARSER_SERVICE_URL", "http://localhost:8001"),

  superAdminEmail: optional("SUPER_ADMIN_EMAIL", ""),
  superAdminPassword: optional("SUPER_ADMIN_PASSWORD", ""),
};
