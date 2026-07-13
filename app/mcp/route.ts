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
  type MindMapData,
} from "@/lib/mind-map";
import { oauthDb } from "@/lib/oauth-db";
import { appBaseUrl, hasScope, oauthResource, OAUTH_SCOPES, type OAuthScope } from "@/lib/oauth";
import { sha256 } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_NOTE_CHARS = 1_800_000;

const textResult = (value: unknown) => ({
  content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
});

const handler = createMcpHandler(({ authInfo }) => {
  const userId = authInfo?.clientId;
  const scopes = authInfo?.scopes;
  if (!userId) throw new Error("MCP user context missing");

  const requireScope = (scope: OAuthScope) => {
    if (!hasScope(scopes, scope)) throw new Error(`OAuth scope required: ${scope}`);
  };

  const server = new McpServer({ name: "FlowChart Mind Map", version: "3.1.0" });

  server.registerTool(
    "whoami",
    { description: "Return the authenticated FlowChart user id.", inputSchema: z.object({}) },
    async () => {
      requireScope("mcp:read");
      return textResult({ userId, scopes });
    },
  );

  server.registerTool(
    "list_maps",
    { description: "List mind maps owned by the authenticated user.", inputSchema: z.object({}) },
    async () => {
      requireScope("mcp:read");
      const maps = await db.mindMap.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        select: { id: true, title: true, updatedAt: true, data: true },
      });
      return textResult(maps.map((map) => ({
        id: map.id,
        title: map.title,
        nodeCount: (map.data as unknown as MindMapData).nodes.length,
        updatedAt: map.updatedAt,
        editUrl: `${appBaseUrl()}/maps/${map.id}`,
      })));
    },
  );

  server.registerTool(
    "create_map",
    {
      description: "Create a mind map. Markdown outline indentation becomes parent-child relationships.",
      inputSchema: z.object({
        title: z.string().min(1).max(120),
        outline_markdown: z.string().optional(),
      }),
    },
    async ({ title, outline_markdown }) => {
      requireScope("mcp:write");
      const data = outline_markdown?.trim()
        ? createMindMapFromOutline(title, outline_markdown)
        : createEmptyMindMap(title);
      const map = await db.mindMap.create({
        data: { userId, title, data: data as unknown as Prisma.InputJsonValue },
      });
      return textResult({ id: map.id, title: map.title, editUrl: `${appBaseUrl()}/maps/${map.id}` });
    },
  );

  server.registerTool(
    "get_map",
    {
      description: "Get one mind map, including each node's Markdown note, owned by the authenticated user.",
      inputSchema: z.object({ map_id: z.string().min(1) }),
    },
    async ({ map_id }) => {
      requireScope("mcp:read");
      const map = await db.mindMap.findFirst({ where: { id: map_id, userId } });
      if (!map) throw new Error("map not found");
      return textResult({ ...map, editUrl: `${appBaseUrl()}/maps/${map.id}` });
    },
  );

  server.registerTool(
    "add_node",
    {
      description: "Add a child node with an optional Markdown note, then automatically rearrange the mind map. note_markdown may include Markdown images.",
      inputSchema: z.object({
        map_id: z.string().min(1),
        parent_id: z.string().min(1),
        text: z.string().min(1).max(500),
        note_markdown: z.string().max(MAX_NOTE_CHARS).optional(),
      }),
    },
    async ({ map_id, parent_id, text, note_markdown }) => {
      requireScope("mcp:write");
      const map = await db.mindMap.findFirst({ where: { id: map_id, userId } });
      if (!map) throw new Error("map not found");
      const addedData = addChildNode(map.data as unknown as MindMapData, parent_id, text);
      const added = addedData.nodes.at(-1);
      const next = note_markdown !== undefined && added
        ? {
            ...addedData,
            nodes: addedData.nodes.map((node) => node.id === added.id ? { ...node, note: note_markdown || undefined } : node),
          }
        : addedData;
      await db.mindMap.update({
        where: { id: map.id },
        data: { data: next as unknown as Prisma.InputJsonValue },
      });
      return textResult({ nodeId: added?.id, noteUpdated: note_markdown !== undefined, editUrl: `${appBaseUrl()}/maps/${map.id}` });
    },
  );

  server.registerTool(
    "update_node",
    {
      description: "Rename a node. Renaming the root also changes the map title.",
      inputSchema: z.object({
        map_id: z.string().min(1),
        node_id: z.string().min(1),
        text: z.string().min(1).max(500),
      }),
    },
    async ({ map_id, node_id, text }) => {
      requireScope("mcp:write");
      const map = await db.mindMap.findFirst({ where: { id: map_id, userId } });
      if (!map) throw new Error("map not found");
      const data = map.data as unknown as MindMapData;
      if (!data.nodes.some((node) => node.id === node_id)) throw new Error("node not found");
      const next = { ...data, nodes: data.nodes.map((node) => node.id === node_id ? { ...node, text } : node) };
      await db.mindMap.update({
        where: { id: map.id },
        data: {
          title: node_id === "root" ? text.slice(0, 120) : map.title,
          data: next as unknown as Prisma.InputJsonValue,
        },
      });
      return textResult({ updated: true, editUrl: `${appBaseUrl()}/maps/${map.id}` });
    },
  );

  server.registerTool(
    "get_node_note",
    {
      description: "Read one node's Markdown note. Markdown image syntax is returned unchanged.",
      inputSchema: z.object({
        map_id: z.string().min(1),
        node_id: z.string().min(1),
      }),
    },
    async ({ map_id, node_id }) => {
      requireScope("mcp:read");
      const map = await db.mindMap.findFirst({ where: { id: map_id, userId } });
      if (!map) throw new Error("map not found");
      const node = (map.data as unknown as MindMapData).nodes.find((item) => item.id === node_id);
      if (!node) throw new Error("node not found");
      return textResult({
        mapId: map.id,
        nodeId: node.id,
        text: node.text,
        noteMarkdown: node.note ?? "",
        editUrl: `${appBaseUrl()}/maps/${map.id}`,
      });
    },
  );

  server.registerTool(
    "update_node_note",
    {
      description: "Replace, append to, or clear a node's Markdown note. Supports standard Markdown image syntax and data:image URLs.",
      inputSchema: z.object({
        map_id: z.string().min(1),
        node_id: z.string().min(1),
        note_markdown: z.string().max(MAX_NOTE_CHARS),
        mode: z.enum(["replace", "append"]).optional(),
      }),
    },
    async ({ map_id, node_id, note_markdown, mode }) => {
      requireScope("mcp:write");
      const map = await db.mindMap.findFirst({ where: { id: map_id, userId } });
      if (!map) throw new Error("map not found");
      const data = map.data as unknown as MindMapData;
      const node = data.nodes.find((item) => item.id === node_id);
      if (!node) throw new Error("node not found");

      const current = node.note?.trimEnd() ?? "";
      const nextNote = mode === "append" && current && note_markdown
        ? `${current}\n\n${note_markdown}`
        : note_markdown;
      if (nextNote.length > MAX_NOTE_CHARS) throw new Error(`note_markdown exceeds ${MAX_NOTE_CHARS} characters`);

      const next = {
        ...data,
        nodes: data.nodes.map((item) => item.id === node_id
          ? { ...item, note: nextNote || undefined }
          : item),
      };
      await db.mindMap.update({
        where: { id: map.id },
        data: { data: next as unknown as Prisma.InputJsonValue },
      });
      return textResult({
        updated: true,
        mode: mode ?? "replace",
        noteLength: nextNote.length,
        editUrl: `${appBaseUrl()}/maps/${map.id}`,
      });
    },
  );

  server.registerTool(
    "delete_node",
    {
      description: "Delete a node and all descendants, then automatically rearrange the map.",
      inputSchema: z.object({ map_id: z.string().min(1), node_id: z.string().min(1) }),
    },
    async ({ map_id, node_id }) => {
      requireScope("mcp:write");
      if (node_id === "root") throw new Error("root node cannot be deleted");
      const map = await db.mindMap.findFirst({ where: { id: map_id, userId } });
      if (!map) throw new Error("map not found");
      const next = deleteNodeTree(map.data as unknown as MindMapData, node_id);
      await db.mindMap.update({
        where: { id: map.id },
        data: { data: next as unknown as Prisma.InputJsonValue },
      });
      return textResult({ deleted: true, editUrl: `${appBaseUrl()}/maps/${map.id}` });
    },
  );

  server.registerTool(
    "auto_layout",
    {
      description: "Automatically arrange the map like XMind. Supports both-side, right-only, or left-only branches.",
      inputSchema: z.object({
        map_id: z.string().min(1),
        layout_mode: z.enum(["both", "right", "left"]).optional(),
      }),
    },
    async ({ map_id, layout_mode }) => {
      requireScope("mcp:write");
      const map = await db.mindMap.findFirst({ where: { id: map_id, userId } });
      if (!map) throw new Error("map not found");
      const data = map.data as unknown as MindMapData;
      const next = autoLayoutMindMap({ ...data, layoutMode: (layout_mode ?? data.layoutMode) as LayoutMode });
      await db.mindMap.update({
        where: { id: map.id },
        data: { data: next as unknown as Prisma.InputJsonValue },
      });
      return textResult({ arranged: true, layoutMode: next.layoutMode, editUrl: `${appBaseUrl()}/maps/${map.id}` });
    },
  );

  return server;
});

function unauthorized(error?: string) {
  const challenge = [
    `Bearer resource_metadata="${appBaseUrl()}/.well-known/oauth-protected-resource"`,
    `scope="${OAUTH_SCOPES.join(" ")}"`,
    error ? `error="${error}"` : "",
  ].filter(Boolean).join(", ");

  return new Response(JSON.stringify({ error: error || "authorization_required" }), {
    status: 401,
    headers: {
      "content-type": "application/json",
      "www-authenticate": challenge,
      "cache-control": "no-store",
    },
  });
}

async function authenticate(request: Request): Promise<AuthInfo | Response> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return unauthorized();

  const token = authorization.slice("Bearer ".length).trim();
  const oauthToken = await oauthDb.findAccessToken(token, oauthResource());
  if (oauthToken) {
    return { token, clientId: oauthToken.userId, scopes: oauthToken.scopes };
  }

  const record = await db.mcpToken.findFirst({
    where: { tokenHash: sha256(token), revokedAt: null },
    select: { id: true, userId: true },
  });
  if (!record) return unauthorized("invalid_token");

  await db.mcpToken.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } });
  return { token, clientId: record.userId, scopes: [...OAUTH_SCOPES] };
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
      "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
    },
  });
}
