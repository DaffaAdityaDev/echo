import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-static'
export const revalidate = 3600

export async function GET() {
  try {
    const specPath = path.resolve(process.cwd(), '../../backend/api/docs/swagger.json')
    const spec = JSON.parse(fs.readFileSync(specPath, 'utf-8'))
    return NextResponse.json(spec, {
      headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' },
    })
  } catch {
    return NextResponse.json(
      { error: 'Failed to load API specification' },
      { status: 500 }
    )
  }
}
