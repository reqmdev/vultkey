import type { NextRequest } from "next/server";
import { signupRequest } from "@/lib/auth/api";

export async function POST(request: NextRequest) {
  return signupRequest(request);
}
