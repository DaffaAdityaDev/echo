import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// The backend swagger spec is not bundled with the frontend image; the path
// must be configurable at deploy time (NEXT_PUBLIC_SPEC_PATH). The legacy
// monorepo-relative path is kept as a fallback for local development.
function resolveSpecCandidates(): string[] {
  const envPath = process.env.NEXT_PUBLIC_SPEC_PATH || process.env.SPEC_PATH;
  const candidates = [];
  if (envPath) {
    candidates.push(path.isAbsolute(envPath) ? envPath : path.resolve(process.cwd(), envPath));
  }
  candidates.push(
    path.resolve(process.cwd(), "../../backend/api/docs/swagger.json"),
    path.resolve(process.cwd(), "backend/api/docs/swagger.json"),
    path.resolve(process.cwd(), "public/api/swagger.json"),
  );
  return candidates;
}

export async function GET() {
  const tried: string[] = [];
  for (const candidate of resolveSpecCandidates()) {
    tried.push(candidate);
    try {
      const spec = JSON.parse(fs.readFileSync(candidate, "utf-8"));
      return NextResponse.json(spec, {
        headers: { "Cache-Control": "no-store" },
      });
    } catch {
      // Unreadable or invalid candidate: try the next known location.
    }
  }

  return NextResponse.json(
    {
      error: "API specification not found",
      detail:
        "The OpenAPI spec file is not available at any known location. Set NEXT_PUBLIC_SPEC_PATH to the swagger.json path (e.g. /app/backend/api/docs/swagger.json).",
      tried,
    },
    { status: 404 },
  );
}
