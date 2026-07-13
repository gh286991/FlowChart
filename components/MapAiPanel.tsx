"use client";

import { useMemo, useRef, useState } from "react";
import styles from "./MapAiPanel.module.css";
import {
  applyMapAiOperations,
  toMapStructure,
  type MapAiOperation,
} from "@/lib/map-ai";
import type { MindMapData } from "@/lib/mind-map";

type Props = {
  open: boolean;
  data: MindMapData;
  onClose: () => void;
  onApply: (next: MindMapData) => void;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  operations?: MapAiOperation[];
};

type ApiPayload = {
  data?: {
    reply?: string;
    operations?: MapAiOperation[];
  };
  error?: string;
};

const QUICK_PROMPTS = [
  "重新整理整體順序",
  "補上缺少的主要階段",
  "把重複節點合併成清楚結構",
  "調整成由左到右的執行流程",
] as const;

function operationLabel(operation: MapAiOperation): string {
  if (operation.type === "add") return `新增「${operation.text}」到 ${operation.parentId}`;
  if (operation.type === "rename") return `將 ${operation.nodeId} 改名為「${operation.text}」`;
  if (operation.type === "move") return `將 ${operation.nodeId} 移到 ${operation.parentId}`;
  if (operation.type === "reorder") return `調整 ${operation.parentId} 的子節點順序`;
  return `版面切換為 ${operation.layoutMode}`;
}

async function readPayload(response: Response): Promise<ApiPayload> {
  const text = await response.text();
  if (!text) return { error: `AI request failed (${response.status})` };
  try {
    return JSON.parse(text) as ApiPayload;
  } catch {
    return { error: text.slice(0, 500) };
  }
}

export default function MapAiPanel({ open, data, onClose, onApply }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const composingRef = useRef(false);
  const structure = useMemo(() => toMapStructure(data), [data]);

  if (!open) return null;

  async function sendMessage() {
    const instruction = input.trim();
    if (!instruction || loading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: instruction,
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/ai/map/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          instruction,
          messages: messages.slice(-8).map(({ role, content }) => ({ role, content })),
          structure,
        }),
      });
      const payload = await readPayload(response);
      const reply = payload.data?.reply?.trim();
      if (!response.ok || !reply) {
        if (response.status === 401) throw new Error("登入已過期，請重新登入後再試。");
        throw new Error(payload.error || "整體 AI 沒有回傳可用結果");
      }

      setMessages((current) => [...current, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: reply,
        operations: payload.data?.operations ?? [],
      }]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "整體 AI 執行失敗");
    } finally {
      setLoading(false);
    }
  }

  function applyOperations(operations: MapAiOperation[]) {
    if (!operations.length) return;
    onApply(applyMapAiOperations(data, operations));
    setMessages((current) => [...current, {
      id: crypto.randomUUID(),
      role: "assistant",
      content: `已套用 ${operations.length} 項結構變更。`,
    }]);
  }

  return (
    <aside className={styles.panel} aria-label="整張心智圖 AI 助手">
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h2>整體 AI 助手</h2>
          <p>只讀節點名稱與父子結構，不讀節點筆記、圖片或附件。</p>
        </div>
        <button type="button" className={styles.close} onClick={onClose} aria-label="關閉整體 AI">×</button>
      </header>

      <div className={styles.scopeNotice}>
        可新增、改名、移動、重新排序節點或切換版面。所有變更都會先預覽，按下套用後才修改心智圖。
      </div>

      <div className={styles.messages}>
        {messages.length === 0 && (
          <div className={styles.empty}>
            例如：「幫我把 Podcast 流程依照前期、錄製、後製、發布重新分組，缺少的步驟也補上。」
          </div>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`${styles.message} ${message.role === "user" ? styles.userMessage : styles.assistantMessage}`}
          >
            {message.content}
            {message.role === "assistant" && message.operations?.length ? (
              <div className={styles.operationCard}>
                {message.operations.map((operation, index) => (
                  <div key={`${message.id}-${index}`} className={styles.operation}>
                    {index + 1}. {operationLabel(operation)}
                  </div>
                ))}
                <button type="button" className={styles.applyButton} onClick={() => applyOperations(message.operations ?? [])}>
                  套用這 {message.operations.length} 項變更
                </button>
              </div>
            ) : null}
          </div>
        ))}
        {loading && <div className={`${styles.message} ${styles.assistantMessage}`}>正在分析整張心智圖結構…</div>}
      </div>

      <div className={styles.quickPrompts}>
        {QUICK_PROMPTS.map((prompt) => (
          <button key={prompt} type="button" onClick={() => setInput(prompt)}>{prompt}</button>
        ))}
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.composer}>
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onCompositionStart={() => { composingRef.current = true; }}
          onCompositionEnd={() => { composingRef.current = false; }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && !composingRef.current) {
              event.preventDefault();
              void sendMessage();
            }
          }}
          placeholder="描述你想如何調整整張心智圖…"
        />
        <div className={styles.composerActions}>
          <span>Enter 送出 · Shift + Enter 換行</span>
          <button type="button" className={styles.send} disabled={!input.trim() || loading} onClick={() => void sendMessage()}>
            {loading ? "處理中…" : "送出"}
          </button>
        </div>
      </div>
    </aside>
  );
}
