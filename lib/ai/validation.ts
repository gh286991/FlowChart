const MAX_NODE_TEXT = 500;
const MAX_MARKDOWN_CHARS = 60_000;

export function assertNonEmptyString(value: unknown, field: string, max = 10_000): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }
  const result = value.trim();
  if (result.length > max) {
    throw new Error(`${field} exceeds ${max} characters`);
  }
  return result;
}

export function normalizeNodeText(value: unknown): string {
  return assertNonEmptyString(value, "nodeText", MAX_NODE_TEXT);
}

export function normalizeMarkdown(value: unknown): string {
  return assertNonEmptyString(value, "content", MAX_MARKDOWN_CHARS);
}

export function normalizeStringArray(
  value: unknown,
  field: string,
  maxItems: number,
  maxLength = 2_000,
): string[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
  return value.slice(0, maxItems).map((item, index) =>
    assertNonEmptyString(item, `${field}[${index}]`, maxLength),
  );
}

export function normalizeUrls(value: unknown): string[] {
  const values = normalizeStringArray(value, "sourceUrls", 3, 2_000);
  return values.map((raw) => {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("sourceUrls only supports http/https URLs");
    }
    return url.toString();
  });
}

export function clampInteger(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}
