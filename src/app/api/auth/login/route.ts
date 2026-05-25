import type { NextRequest } from "next/server";
import { loginRequest } from "@/lib/auth/api";

export async function POST(request: NextRequest) {
  return loginRequest(request);
}
