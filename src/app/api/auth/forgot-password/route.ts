import type { NextRequest } from "next/server";
import { forgotPasswordRequest } from "@/lib/auth/api";

export async function POST(request: NextRequest) {
  return forgotPasswordRequest(request);
}
