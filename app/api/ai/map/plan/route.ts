import { z } from "zod";
import { readJsonRequest, runAuthenticatedAiRoute } from "@/lib/ai/http";
import { generateStructured } from "@/lib/ai/workers-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(2_000),
});

const StructureNodeSchema = z.object({
  id: z.string().trim().min(1).max(120),
  parentId: z.string().trim().min(1).max(120).nullable(),
  text: z.string().trim().min(1).max(300),
  side: z.enum(["left", "right"]).optional(),
});

const InputSchema = z.object({
  instruction: z.string().trim().min(1).max(3_000),
  messages: z.array(MessageSchema).max(12).default([]),
  structure: z.object({
    layoutMode: z.enum(["both", "left", "right"]),
    nodes: z.array(StructureNodeSchema).min(1).max(240),
  }),
});

const RawOperationSchema = z.object({
  type: z.enum(["add", "rename", "move", "reorder", "layout"]),
  nodeId: z.string().trim().max(120).optional(),
  parentId: z.string().trim().max(120).optional(),
  text: z.string().trim().max(160).optional(),
  orderedNodeIds: z.array(z.string().trim().max(120)).max(80).optional(),
  layoutMode: z.enum(["both", "left", "right"]).optional(),
});

const OutputSchema = z.object({
  reply: z.string().trim().min(1).max(3_000),
  operations: z.array(RawOperationSchema).max(40),
});

const OUTPUT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "operations"],
  properties: {
    reply: { type: "string", minLength: 1, maxLength: 3000 },
    operations: {
      type: "array",
      maxItems: 40,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type"],
        properties: {
          type: { type: "string", enum: ["add", "rename", "move", "reorder", "layout"] },
          nodeId: { type: "string", maxLength: 120 },
          parentId: { type: "string", maxLength: 120 },
          text: { type: "string", maxLength: 160 },
          orderedNodeIds: {
            type: "array",
            maxItems: 80,
            items: { type: "string", maxLength: 120 },
          },
          layoutMode: { type: "string", enum: ["both", "left", "right"] },
        },
      },
    },
  },
} as const;

type ParsedInput = z.infer<typeof InputSchema>;
type RawOperation = z.infer<typeof RawOperationSchema>;

function validOperations(input: ParsedInput, operations: RawOperation[]) {
  const ids = new Set(input.structure.nodes.map((node) => node.id));

  return operations.flatMap((operation) => {
    if (operation.type === "add") {
      return operation.parentId && ids.has(operation.parentId) && operation.text
        ? [{ type: "add" as const, parentId: operation.parentId, text: operation.text }]
        : [];
    }
    if (operation.type === "rename") {
      return operation.nodeId && ids.has(operation.nodeId) && operation.text
        ? [{ type: "rename" as const, nodeId: operation.nodeId, text: operation.text }]
        : [];
    }
    if (operation.type === "move") {
      return operation.nodeId
        && operation.nodeId !== "root"
        && ids.has(operation.nodeId)
        && operation.parentId
        && ids.has(operation.parentId)
        ? [{ type: "move" as const, nodeId: operation.nodeId, parentId: operation.parentId }]
        : [];
    }
    if (operation.type === "reorder") {
      return operation.parentId && ids.has(operation.parentId) && operation.orderedNodeIds?.length
        ? [{
            type: "reorder" as const,
            parentId: operation.parentId,
            orderedNodeIds: operation.orderedNodeIds.filter((id) => ids.has(id)),
          }]
        : [];
    }
    return operation.layoutMode
      ? [{ type: "layout" as const, layoutMode: operation.layoutMode }]
      : [];
  });
}

export async function POST(request: Request) {
  return runAuthenticatedAiRoute(async (env) => {
    const input = InputSchema.parse(await readJsonRequest<unknown>(request));
    const recentConversation = input.messages
      .slice(-8)
      .map((message) => `${message.role === "user" ? "使用者" : "助理"}：${message.content}`)
      .join("\n");

    const raw = await generateStructured<unknown>(env, {
      maxTokens: 3_500,
      schema: OUTPUT_JSON_SCHEMA,
      messages: [
        {
          role: "system",
          content: [
            "你是心智圖整體結構助理。",
            "你只能根據提供的節點 id、名稱、父節點與排列資訊工作。",
            "你看不到也不可以要求讀取節點筆記、圖片、附件、來源網址或其他檔案。",
            "輸出 reply 與 operations。先用 reply 簡短說明方案，再列出需要預覽的操作。",
            "允許的操作：add、rename、move、reorder、layout。不要刪除節點。",
            "add 的 parentId、rename/move 的 nodeId、move/reorder 的 parentId 必須使用現有 id。",
            "reorder 只調整同一 parentId 下的直接子節點。",
            "沒有必要變更時，operations 請回傳空陣列。",
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            recentConversation ? `最近對話：\n${recentConversation}` : "",
            `使用者要求：\n${input.instruction}`,
            "目前心智圖結構（不含任何節點筆記或檔案）：",
            JSON.stringify(input.structure),
          ].filter(Boolean).join("\n\n"),
        },
      ],
    });

    const output = OutputSchema.parse(raw);
    return {
      reply: output.reply,
      operations: validOperations(input, output.operations),
    };
  });
}
