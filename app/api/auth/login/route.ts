import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { createSession, sessionCookieOptions } from "@/lib/auth";
import { db } from "@/lib/db";

function redirectWithError(request: Request, message: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  const user = await db.user.findUnique({ where: { email } });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return redirectWithError(request, "Email 或密碼錯誤");
  }

  const token = await createSession(user.id);
  const response = NextResponse.redirect(new URL("/dashboard", request.url), 303);
  response.cookies.set({ ...sessionCookieOptions(), value: token });
  return response;
}
