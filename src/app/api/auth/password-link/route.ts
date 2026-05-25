import type { NextRequest } from "next/server";
import { passwordLinkRequest } from "@/lib/auth/api";

export async function POST(request: NextRequest) {
  return passwordLinkRequest(request);
}
