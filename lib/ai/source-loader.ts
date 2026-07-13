import type { AiEnv, SourceDocument } from "./types";

const MAX_SOURCE_CHARS = 14_000;
const MAX_SOURCE_BYTES = 240_000;
const MAX_REDIRECTS = 3;
const ALLOWED_CONTENT_TYPES = [
  "text/html",
  "text/plain",
  "text/markdown",
  "application/json",
  "application/xml",
  "text/xml",
];

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

export function htmlToReadableText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function extractTitle(html: string, fallback: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? htmlToReadableText(match[1]).slice(0, 200) : fallback;
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return false;
  const values = parts.map(Number);
  if (values.some((value) => value < 0 || value > 255)) return false;
  const [a, b] = values;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

function isPrivateHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal")
  ) {
    return true;
  }
  if (isPrivateIpv4(normalized)) return true;
  if (normalized.includes(":")) {
    return (
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") ||
      normalized.startsWith("fea") ||
      normalized.startsWith("feb") ||
      normalized.startsWith("::ffff:10.") ||
      normalized.startsWith("::ffff:127.") ||
      normalized.startsWith("::ffff:192.168.")
    );
  }
  return !normalized.includes(".");
}

function assertPublicSourceUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("sourceUrls only supports http/https URLs");
  }
  if (url.username || url.password || isPrivateHostname(url.hostname)) {
    throw new Error("sourceUrls cannot target private or local addresses");
  }
  return url;
}

async function fetchWithSafeRedirects(input: URL, signal: AbortSignal): Promise<Response> {
  let current = input;
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const response = await fetch(current, {
      redirect: "manual",
      signal,
      headers: {
        "user-agent": "FlowChart-AI/1.0 (+https://github.com/gh286991/FlowChart)",
        accept:
          "text/html,text/plain,text/markdown,application/json,application/xml;q=0.9,*/*;q=0.1",
      },
    });

    if (response.status < 300 || response.status >= 400) return response;
    const location = response.headers.get("location");
    if (!location) throw new Error(`Source returned redirect ${response.status} without location`);
    current = assertPublicSourceUrl(new URL(location, current).toString());
  }
  throw new Error("Source exceeded redirect limit");
}

async function readLimitedText(response: Response): Promise<string> {
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_SOURCE_BYTES) throw new Error("Source response is too large");
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let output = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_SOURCE_BYTES) throw new Error("Source response is too large");
      output += decoder.decode(value, { stream: true });
    }
    output += decoder.decode();
    return output;
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

export async function fetchSource(rawUrl: string): Promise<SourceDocument> {
  const url = assertPublicSourceUrl(rawUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetchWithSafeRedirects(url, controller.signal);
    if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);

    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    if (!ALLOWED_CONTENT_TYPES.some((type) => contentType.includes(type))) {
      throw new Error(`Unsupported source content-type: ${contentType || "unknown"}`);
    }

    const raw = await readLimitedText(response);
    const isHtml = contentType.includes("html") || /<html[\s>]/i.test(raw);
    const content = (isHtml ? htmlToReadableText(raw) : raw).slice(0, MAX_SOURCE_CHARS);
    return {
      title: isHtml ? extractTitle(raw, url.hostname) : url.hostname,
      url: url.toString(),
      content,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function searchIndexedKnowledge(
  env: AiEnv,
  query: string,
): Promise<SourceDocument | null> {
  if (!env.AI_SEARCH) return null;
  const instanceName = env.AI_SEARCH_INSTANCE?.trim() || "flowchart-knowledge";
  const instance = env.AI_SEARCH.get(instanceName);
  const result = await instance.search({
    messages: [{ role: "user", content: query }],
    ai_search_options: { retrieval: { max_num_results: 5 } },
  });
  return {
    title: `Cloudflare AI Search: ${instanceName}`,
    content: JSON.stringify(result).slice(0, 20_000),
  };
}

export async function loadResearchSources(
  env: AiEnv,
  query: string,
  urls: string[],
): Promise<{ sources: SourceDocument[]; errors: string[] }> {
  const errors: string[] = [];
  const sources: SourceDocument[] = [];

  try {
    const indexed = await searchIndexedKnowledge(env, query);
    if (indexed) sources.push(indexed);
  } catch (error) {
    errors.push(`AI Search failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  const fetched = await Promise.allSettled(urls.map(fetchSource));
  fetched.forEach((result, index) => {
    if (result.status === "fulfilled") sources.push(result.value);
    else {
      errors.push(
        `${urls[index]}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
      );
    }
  });

  return { sources, errors };
}
