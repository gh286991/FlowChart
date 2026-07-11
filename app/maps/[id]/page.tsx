import { notFound, redirect } from "next/navigation";
import MindMapEditor from "@/components/MindMapEditor";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { MindMapData } from "@/lib/mind-map";

export default async function MapPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;

  const map = await db.mindMap.findFirst({ where: { id, userId: user.id } });
  if (!map) notFound();

  return (
    <MindMapEditor
      initialMap={{
        id: map.id,
        title: map.title,
        data: map.data as unknown as MindMapData
      }}
    />
  );
}
