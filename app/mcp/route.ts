import { Prisma } from "@prisma/client";
import { createMcpHandler, McpServer, type AuthInfo } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { db } from "@/lib/db";
import {
  addChildNode,
  autoLayoutMindMap,
  createEmptyMindMap,
  createMindMapFromOutline,
  deleteNodeTree,
  type LayoutMode,
  type MindMapData
} from "@/lib/mind-map";
import { sha256 } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
const textResult = (value: unknown) => ({
  content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }]
});

const handler = createMcpHandler(({ authInfo }) => {
  const userId = authInfo?.clientId;
  if (!userId) throw new Error("MCP user context missing");

  const server = new McpServer({ name: "FlowChart Mind Map", version: "2.0.0" });

  server.registerTool(
    "whoami",
    { description: "Return the authenticated FlowChart user id.", inputSchema: z.object({}) },
    async () => textResult({ userId })
  );

  server.registerTool(
    "list_maps",
    { description: "List mind maps owned by the authenticated user.", inputSchema: z.object({}) },
    async () => {
      const maps = await db.mindMap.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        select: { id: true, title: true, updatedAt: true, data: true }
      });
      return textResult(maps.map(map => ({
        id: map.id,
        title: map.title,
        nodeCount: (map.data as unknown as MindMapData).nodes.length,
        updatedAt: map.updatedAt,
        editUrl: `${appUrl()}/maps/${map.id}`
      })));
    }
  );

  server.registerTool(
    "create_map",
    {
      description: "Create a mind map. Markdown outline indentation becomes parent-child relationships.",
      inputSchema: z.object({
        title: z.string().min(1).max(120),
        outline_markdown: z.string().optional()
      })
    },
    async ({ title, outline_markdown }) => {
      const data = outline_markdown?.trim()
        ? createMindMapFromOutline(title, outline_markdown)
        : createEmptyMindMap(title);
      const map = await db.mindMap.create({
        data: { userId, title, data: data as unknown as Prisma.InputJsonValue }
      });
      return textResult({ id: map.id, title: map.title, editUrl: `${appUrl()}/maps/${map.id}` });
    }
  );

  server.registerTool(
    "get_map",
    {
      description: "Get one mind map owned by the authenticated user.",
      inputSchema: z.object({ map_id: z.string().min(1) })
    },
    async ({ map_id }) => {
      const map = await db.mindMap.findFirst({ where: { id: map_id, userId } });
      if (!map) throw new Error("map not found");
      return textResult({ ...map, editUrl: `${appUrl()}/maps/${map.id}` });
    }
  );

  server.registerTool(
    "add_node",
    {
      description: "Add a child node and automatically rearrange the mind map.",
      inputSchema: z.object({
        map_id: z.string().min(1),
        parent_id: z.string().min(1),
        text: z.string().min(1).max(500)
      })
    },
    async ({ map_id, parent_id, text }) => {
      const map = await db.mindMap.findFirst({ where: { id: map_id, userId } });
      if (!map) throw new Error("map not found");
      const next = addChildNode(map.data as unknown as MindMapData, parent_id, text);
      const added = next.nodes.at(-1);
      await db.mindMap.update({
        where: { id: map.id },
        data: { data: next as unknown as Prisma.InputJsonValue }
      });
      return textResult({ nodeId: added?.id, editUrl: `${appUrl()}/maps/${map.id}` });
    }
  );

  server.registerTool(
    "update_node",
    {
      description: "Rename a node. Renaming the root also changes the map title.",
      inputSchema: z.object({
        map_id: z.string().min(1),
        node_id: z.string().min(1),
        text: z.string().min(1).max(500)
      })
    },
    async ({ map_id, node_id, text }) => {
      const map = await db.mindMap.findFirst({ where: { id: map_id, userId } });
      if (!map) throw new Error("map not found");
      const data = map.data as unknown as MindMapData;
      if (!data.nodes.some(node => node.id === node_id)) throw new Error("node not found");
      const next = { ...data, nodes: data.nodes.map(node => node.id === node_id ? { ...node, text } : node) };
      await db.mindMap.update({
        where: { id: map.id },
        data: {
          title: node_id === "root" ? text.slice(0, 120) : map.title,
          data: next as unknown as Prisma.InputJsonValue
        }
      });
      return textResult({ updated: true, editUrl: `${appUrl()}/maps/${map.id}` });
    }
  );

  server.registerTool(
    "delete_node",
    {
      description: "Delete a node and all descendants, then automatically rearrange the map.",
      inputSchema: z.object({ map_id: z.string().min(1), node_id: z.string().min(1) })
    },
    async ({ map_id, node_id }) => {
      if (node_id === "root") throw new Error("root node cannot be deleted");
      const map = await db.mindMap.findFirst({ where: { id: map_id, userId } });
      if (!map) throw new Error("map not found");
      const next = deleteNodeTree(map.data as unknown as MindMapData, node_id);
      await db.mindMap.update({
        where: { id: map.id },
        data: { data: next as unknown as Prisma.InputJsonValue }
      });
      return textResult({ deleted: true, editUrl: `${appUrl()}/maps/${map.id}` });
    }
  );

  server.registerTool(
    "auto_layout",
    {
      description: "Automatically arrange the map like XMind. Supports both-side, right-only, or left-only branches.",
      inputSchema: z.object({
        map_id: z.string().min(1),
        layout_mode: z.enum(["both", "right", "left"]).optional()
      })
    },
    async ({ map_id, layout_mode }) => {
      const map = await db.mindMap.findFirst({ where: { id: map_id, userId } });
      if (!map) throw new Error("map not found");
      const data = map.data as unknown as MindMapData;
      const next = autoLayoutMindMap({ ...data, layoutMode: (layout_mode ?? data.layoutMode) as LayoutMode });
      await db.mindMap.update({
        where: { id: map.id },
        data: { data: next as unknown as Prisma.InputJsonValue }
      });
      return textResult({ arranged: true, layoutMode: next.layoutMode, editUrl: `${appUrl()}/maps/${map.id}` });
    }
  );

  return server;
});

async function authenticate(request: Request): Promise<AuthInfo | Response> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "missing bearer token" }), {
      status: 401,
      headers: {
        "content-type": "application/json",
        "www-authenticate": "Bearer realm=\"FlowChart MCP\""
      }
    });
  }

  const token = authorization.slice("Bearer ".length).trim();
  const record = await db.mcpToken.findFirst({
    where: { tokenHash: sha256(token), revokedAt: null },
    select: { id: true, userId: true }
  });
  if (!record) {
    return new Response(JSON.stringify({ error: "invalid or revoked token" }), {
      status: 401,
      headers: {
        "content-type": "application/json",
        "www-authenticate": "Bearer error=\"invalid_token\""
      }
    });
  }

  await db.mcpToken.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } });
  return { token, clientId: record.userId, scopes: ["mcp"] };
}

async function handle(request: Request) {
  const auth = await authenticate(request);
  if (auth instanceof Response) return auth;
  return handler.fetch(request, { authInfo: auth });
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization,content-type,mcp-protocol-version,mcp-session-id",
      "access-control-allow-methods": "GET,POST,DELETE,OPTIONS"
    }
  });
}
