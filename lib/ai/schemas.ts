export const researchSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    freshnessWarning: { type: ["string", "null"] },
    suggestedSearchQueries: {
      type: "array",
      items: { type: "string" },
      maxItems: 8,
    },
    findings: {
      type: "array",
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
          sourceUrls: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["title", "detail", "sourceUrls"],
      },
    },
    suggestedNodes: {
      type: "array",
      maxItems: 10,
      items: { $ref: "#/$defs/node" },
    },
  },
  required: [
    "summary",
    "freshnessWarning",
    "suggestedSearchQueries",
    "findings",
    "suggestedNodes",
  ],
  $defs: {
    node: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        note: { type: "string" },
        kind: {
          type: "string",
          enum: ["topic", "fact", "question", "risk", "task", "source"],
        },
        sourceUrls: {
          type: "array",
          items: { type: "string" },
        },
        children: {
          type: "array",
          maxItems: 6,
          items: { $ref: "#/$defs/node" },
        },
      },
      required: ["title", "sourceUrls", "children"],
    },
  },
} as const;

export const taskSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    goal: { type: "string" },
    assumptions: { type: "array", items: { type: "string" }, maxItems: 8 },
    tasks: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          acceptanceCriteria: {
            type: "array",
            items: { type: "string" },
            maxItems: 6,
          },
          estimate: { type: "string", enum: ["XS", "S", "M", "L", "XL"] },
          dependencies: {
            type: "array",
            items: { type: "string" },
            maxItems: 6,
          },
        },
        required: [
          "title",
          "description",
          "acceptanceCriteria",
          "estimate",
          "dependencies",
        ],
      },
    },
  },
  required: ["goal", "assumptions", "tasks"],
} as const;

export const markdownSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    normalizedMarkdown: { type: "string" },
    outline: {
      type: "array",
      maxItems: 20,
      items: { $ref: "#/$defs/node" },
    },
    warnings: { type: "array", items: { type: "string" }, maxItems: 8 },
  },
  required: ["title", "summary", "normalizedMarkdown", "outline", "warnings"],
  $defs: researchSchema.$defs,
} as const;
