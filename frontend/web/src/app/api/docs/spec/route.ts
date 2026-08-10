import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const specPath = path.resolve(process.cwd(), "../../backend/api/docs/swagger.json");
    const spec = JSON.parse(fs.readFileSync(specPath, "utf-8"));
    return NextResponse.json(spec, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Failed to load API specification" }, { status: 500 });
  }
}
