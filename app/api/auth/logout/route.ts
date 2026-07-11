import { NextResponse } from "next/server";
import { deleteCurrentSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";

export async function POST(request: Request) {
  await deleteCurrentSession();
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  response.cookies.set({
    ...sessionCookieOptions(new Date(0)),
    name: SESSION_COOKIE,
    value: "",
    maxAge: 0
  });
  return response;
}
