import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { MindMapData } from "@/lib/mind-map";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const map = await db.mindMap.findFirst({ where: { id, userId: user.id } });
  if (!map) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(map);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = await db.mindMap.findFirst({ where: { id, userId: user.id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await request.json() as { title?: string; data?: MindMapData };
  const title = body.title?.trim().slice(0, 120) || "未命名心智圖";
  if (!body.data || !Array.isArray(body.data.nodes) || !Array.isArray(body.data.edges)) {
    return NextResponse.json({ error: "invalid map data" }, { status: 400 });
  }

  const map = await db.mindMap.update({
    where: { id },
    data: { title, data: body.data as unknown as Prisma.InputJsonValue }
  });
  return NextResponse.json(map);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const deleted = await db.mindMap.deleteMany({ where: { id, userId: user.id } });
  if (!deleted.count) return NextResponse.json({ error: "not found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
