/**
 * @file route.ts
 * @description TODO(phase-1): Implement route handler
 */
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ status: "ok" });
}
