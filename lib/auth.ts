import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { createOpaqueToken, sha256 } from "@/lib/security";

const SESSION_COOKIE = "flowchart_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export async function createSession(userId: string): Promise<string> {
  const token = createOpaqueToken("sess");
  await db.session.create({
    data: {
      userId,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS)
    }
  });
  return token;
}

export function sessionCookieOptions(expiresAt = new Date(Date.now() + SESSION_TTL_MS)) {
  return {
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.SESSION_COOKIE_SECURE !== "false" && process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt
  };
}

export function safeInternalPath(value: string | null | undefined, fallback = "/dashboard"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true }
  });

  if (!session || !("user" in session) || session.expiresAt <= new Date()) {
    if (session) await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  return session.user;
}

export async function deleteCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return;
  await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
}

export { SESSION_COOKIE };
