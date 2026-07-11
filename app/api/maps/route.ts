import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createEmptyMindMap, createMindMapFromOutline } from "@/lib/mind-map";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const maps = await db.mindMap.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, updatedAt: true, createdAt: true }
  });
  return NextResponse.json(maps);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url), 303);

  const isJson = request.headers.get("content-type")?.includes("application/json");
  let title = "新的心智圖";
  let outline = "";

  if (isJson) {
    const body = await request.json() as { title?: string; outline?: string };
    title = body.title?.trim().slice(0, 120) || title;
    outline = body.outline?.trim() || "";
  } else {
    const form = await request.formData();
    title = String(form.get("title") || title).trim().slice(0, 120) || title;
    outline = String(form.get("outline") || "").trim();
  }

  const data = outline ? createMindMapFromOutline(title, outline) : createEmptyMindMap(title);
  const map = await db.mindMap.create({
    data: {
      userId: user.id,
      title,
      data: data as unknown as Prisma.InputJsonValue
    }
  });

  if (isJson) return NextResponse.json(map, { status: 201 });
  return NextResponse.redirect(new URL(`/maps/${map.id}`, request.url), 303);
}
