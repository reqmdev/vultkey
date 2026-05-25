import type { NextRequest } from "next/server";
import { deleteAccountRequest } from "@/lib/auth/api";

export async function POST(request: NextRequest) {
  return deleteAccountRequest(request);
}
