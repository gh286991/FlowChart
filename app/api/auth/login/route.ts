import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { createSession, safeInternalPath, sessionCookieOptions } from "@/lib/auth";
import { db } from "@/lib/db";

function redirectWithError(request: Request, message: string, returnTo: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", message);
  url.searchParams.set("returnTo", returnTo);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  const returnTo = safeInternalPath(String(form.get("returnTo") || ""));
  const user = await db.user.findUnique({ where: { email } });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return redirectWithError(request, "Email 或密碼錯誤", returnTo);
  }

  const token = await createSession(user.id);
  const response = NextResponse.redirect(new URL(returnTo, request.url), 303);
  response.cookies.set({ ...sessionCookieOptions(), value: token });
  return response;
}
