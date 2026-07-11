import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { createSession, sessionCookieOptions } from "@/lib/auth";
import { db } from "@/lib/db";

function redirectWithError(request: Request, message: string) {
  const url = new URL("/register", request.url);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  const form = await request.formData();
  const name = String(form.get("name") || "").trim().slice(0, 60) || null;
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");

  if (!/^\S+@\S+\.\S+$/.test(email)) return redirectWithError(request, "Email 格式不正確");
  if (password.length < 8) return redirectWithError(request, "密碼至少需要 8 個字元");

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await db.user.create({ data: { name, email, passwordHash } });
    const token = await createSession(user.id);
    const response = NextResponse.redirect(new URL("/dashboard", request.url), 303);
    response.cookies.set({ ...sessionCookieOptions(), value: token });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("UNIQUE") || message.includes("unique")) {
      return redirectWithError(request, "這個 Email 已經註冊過了");
    }
    return redirectWithError(request, "註冊失敗，請稍後再試");
  }
}
