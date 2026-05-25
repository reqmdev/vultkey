import type { NextRequest } from "next/server";
import { resetPasswordRequest } from "@/lib/auth/api";

export async function POST(request: NextRequest) {
  return resetPasswordRequest(request);
}
