import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createOpaqueToken, sha256 } from "@/lib/security";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json() as { name?: string };
  const name = body.name?.trim().slice(0, 80);
  if (!name) return NextResponse.json({ error: "請輸入 Token 名稱" }, { status: 400 });

  const token = createOpaqueToken("fc_live");
  const record = await db.mcpToken.create({
    data: {
      name,
      tokenHash: sha256(token),
      tokenPrefix: token.slice(0, 18),
      userId: user.id
    },
    select: {
      id: true,
      name: true,
      tokenPrefix: true,
      createdAt: true,
      lastUsedAt: true,
      revokedAt: true
    }
  });

  return NextResponse.json({ token, record }, { status: 201 });
}
