#!/usr/bin/env node
/**
 * GPT Image 2 MCP Server
 *
 * Exposes OpenAI GPT Image 2 image generation and editing as MCP tools.
 * Mirrors the official endpoints:
 *   - client.images.generate(...)  — text → image
 *   - client.images.edit(...)      — text + image(s) → image (with optional mask)
 *
 * Reads OPENAI_API_KEY from process env, then ./.env, then ~/.env.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import OpenAI from "openai";
import { config as loadEnv } from "dotenv";
import { promises as fs } from "fs";
import { existsSync, readFileSync, readdirSync } from "fs";
import path from "path";
import os from "os";
import http from "http";
import { fileURLToPath } from "url";
import { parseRuntimeConfig } from "./runtime-config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- env chain: process env wins, then ./.env, then ~/.env ----
loadEnv({ path: path.join(process.cwd(), ".env"), override: false });
loadEnv({ path: path.join(os.homedir(), ".env"), override: false });

const PACKAGE_ROOT = path.resolve(__dirname, "..");
const REFERENCES_DIR = path.join(PACKAGE_ROOT, "references");

const SIZE_SHORTCUTS: Record<string, string> = {
  "1k": "1024x1024",
  "2k": "2048x2048",
  "4k": "3840x2160",
  portrait: "1024x1536",
  landscape: "1536x1024",
  square: "1024x1024",
  wide: "2048x1152",
  tall: "2160x3840",
};

const DEFAULT_MODEL = "gpt-image-2";
const DEFAULT_SIZE = "1024x1024";
const DEFAULT_MODERATION = "low";

function resolveSize(value: string): string {
  return SIZE_SHORTCUTS[value.toLowerCase()] ?? value;
}

function slugify(text: string, maxLen = 30): string {
  const s = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[-\s]+/g, "-")
    .slice(0, maxLen);
  return s || "image";
}

function defaultOutputPath(prompt: string, ext: string): string {
  const cwd = process.cwd();
  const figDir = path.join(cwd, "fig");
  const targetDir = existsSync(figDir) ? figDir : cwd;
  const stamp = new Date()
    .toISOString()
    .replace(/[:T]/g, "-")
    .replace(/\..*/, "")
    .slice(0, 19);
  return path.join(targetDir, `${stamp}-${slugify(prompt)}.${ext}`);
}

function modelRejectsInputFidelity(model: string): boolean {
  return model.trim().toLowerCase().startsWith("gpt-image-2");
}

function filterUndefined<T extends Record<string, unknown>>(o: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v !== undefined && v !== null) out[k] = v;
  }
  return out as Partial<T>;
}

// ---- shared types ----
interface GenerateArgs {
  prompt: string;
  file?: string;
  model?: string;
  size?: string;
  quality?: "auto" | "low" | "medium" | "high";
  n?: number;
  background?: "auto" | "opaque";
  moderation?: "auto" | "low";
  format?: "png" | "jpeg" | "webp";
  compression?: number;
  user?: string;
}

interface EditArgs extends GenerateArgs {
  image: string[];
  mask?: string;
  input_fidelity?: "low" | "high";
}

async function writeOutputs(
  data: Array<{ b64_json?: string | null; url?: string | null }>,
  outPath: string,
  n: number,
): Promise<string[]> {
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  const written: string[] = [];
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    let raw: Buffer;
    if (item.b64_json) {
      raw = Buffer.from(item.b64_json, "base64");
    } else if (item.url) {
      const res = await fetch(item.url);
      if (!res.ok) throw new Error(`failed to fetch result url: ${res.status}`);
      raw = Buffer.from(await res.arrayBuffer());
    } else {
      throw new Error(`response item ${i} has neither b64_json nor url`);
    }
    let target: string;
    if (n === 1) {
      target = outPath;
    } else {
      const ext = path.extname(outPath);
      const stem = outPath.slice(0, outPath.length - ext.length);
      target = `${stem}_${i}${ext}`;
    }
    await fs.writeFile(target, raw);
    written.push(target);
  }
  return written;
}

function getClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  return new OpenAI();
}

async function runGenerate(args: GenerateArgs, server?: Server): Promise<string[] | { usedSampling: true; prompt: string }> {
  const client = getClient();
  
  // Mode 1: Use OpenAI API if key is available
  if (client) {
    const ext = args.format ?? "png";
    const outPath = args.file
      ? path.resolve(args.file.replace(/^~/, os.homedir()))
      : defaultOutputPath(args.prompt, ext);

    const params = filterUndefined({
      model: args.model ?? DEFAULT_MODEL,
      prompt: args.prompt,
      size: resolveSize(args.size ?? DEFAULT_SIZE),
      quality: args.quality ?? "high",
      n: args.n ?? 1,
      background: args.background,
      moderation: args.moderation ?? DEFAULT_MODERATION,
      output_format: args.format,
      output_compression: args.compression,
      user: args.user,
    });

    const result = await client.images.generate(params as any);
    const data = result.data ?? [];
    if (data.length === 0) {
      throw new Error("no image data in response");
    }
    return writeOutputs(data, outPath, args.n ?? 1);
  }
  
  // Mode 2: Use sampling to request client-side image generation
  if (!server) {
    throw new Error("No OPENAI_API_KEY and no server instance for sampling");
  }
  
  return { usedSampling: true, prompt: args.prompt };
}

async function runEdit(args: EditArgs, server?: Server): Promise<string[] | { usedSampling: true; prompt: string }> {
  const client = getClient();
  
  // Without an API key we can't read remote refs anyway; return sampling sentinel
  if (!client) {
    if (!server) {
      throw new Error("No OPENAI_API_KEY and no server instance for sampling");
    }
    return { usedSampling: true, prompt: args.prompt };
  }
  
  const ext = args.format ?? "png";
  const outPath = args.file
    ? path.resolve(args.file.replace(/^~/, os.homedir()))
    : defaultOutputPath(args.prompt, ext);

  for (const p of args.image) {
    if (!existsSync(p)) throw new Error(`--image not found: ${p}`);
  }
  if (args.mask && !existsSync(args.mask)) {
    throw new Error(`--mask not found: ${args.mask}`);
  }

  let inputFidelity = args.input_fidelity;
  const model = args.model ?? DEFAULT_MODEL;
  const noteParts: string[] = [];
  if (inputFidelity && modelRejectsInputFidelity(model)) {
    noteParts.push(
      "note: dropping input_fidelity because gpt-image-2 rejects that parameter.",
    );
    inputFidelity = undefined;
  }

  // OpenAI Node SDK accepts file paths via toFile or fs.ReadStream
  const { toFile } = await import("openai");
  const imageFiles = await Promise.all(
    args.image.map(async (p) =>
      toFile(await fs.readFile(p), path.basename(p)),
    ),
  );
  const maskFile = args.mask
    ? await toFile(await fs.readFile(args.mask), path.basename(args.mask))
    : undefined;

  const params = filterUndefined({
    model,
    image: imageFiles,
    mask: maskFile,
    prompt: args.prompt,
    size: resolveSize(args.size ?? DEFAULT_SIZE),
    quality: args.quality ?? "high",
    n: args.n ?? 1,
    background: args.background,
    input_fidelity: inputFidelity,
    output_format: args.format,
    output_compression: args.compression,
    user: args.user,
  });

  const result = await client.images.edit(params as any);
  const data = result.data ?? [];
  if (data.length === 0) {
    throw new Error("no image data in response");
  }
  const written = await writeOutputs(data, outPath, args.n ?? 1);
  if (noteParts.length) {
    // attach note via a sibling sentinel; surfaced by caller
    (written as any)._note = noteParts.join("\n");
  }
  return written;
}

function createMcpServer(): Server {
  const server = new Server(
  {
    name: "gpt-image-2-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  },
);

// ---- Tools ----
const COMMON_PROPS = {
  prompt: {
    type: "string",
    description: "Text prompt or edit instruction (required).",
  },
  file: {
    type: "string",
    description:
      "Output file path. Auto-named (./fig/ or ./) using a timestamp + slug if omitted.",
  },
  model: {
    type: "string",
    description: `Image model id (default ${DEFAULT_MODEL}).`,
    default: DEFAULT_MODEL,
  },
  size: {
    type: "string",
    description:
      "Canvas size. Literal (e.g. 1024x1024, 1536x1024, 2048x2048) or shortcut (1k, 2k, 4k, portrait, landscape, square, wide, tall).",
    default: DEFAULT_SIZE,
  },
  quality: {
    type: "string",
    enum: ["auto", "low", "medium", "high"],
    description:
      "Rendering fidelity. low=cheap drafts, medium=normal exploration, high=final/text-heavy/UI.",
    default: "high",
  },
  n: {
    type: "integer",
    description: "Number of images to return.",
    default: 1,
    minimum: 1,
  },
  background: {
    type: "string",
    enum: ["auto", "opaque"],
    description: "`opaque` disables transparency. Default API-side auto.",
  },
  format: {
    type: "string",
    enum: ["png", "jpeg", "webp"],
    description: "Output encoding. Default png.",
  },
  compression: {
    type: "integer",
    minimum: 0,
    maximum: 100,
    description: "0-100 compression for jpeg/webp. Ignored for png.",
  },
  user: {
    type: "string",
    description: "Optional end-user identifier forwarded to OpenAI.",
  },
};

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "generate_image",
      description:
        "Text-to-image via OpenAI GPT Image 2 (/v1/images/generations) or client-side image generation. If OPENAI_API_KEY is configured, generates and saves images directly. Otherwise, returns an optimized prompt for the client to render with its own image tool. Use for fresh creations: posters, illustrations, UI mockups, diagrams, typography, photography.",
      inputSchema: {
        type: "object",
        properties: {
          ...COMMON_PROPS,
          moderation: {
            type: "string",
            enum: ["auto", "low"],
            description: "Generations only. Default low.",
            default: DEFAULT_MODERATION,
          },
        },
        required: ["prompt"],
      },
    },
    {
      name: "edit_image",
      description:
        "Reference-image edit / inpaint via GPT Image 2 (/v1/images/edits) or client-side editing. If OPENAI_API_KEY is configured, edits via API. Otherwise, returns an optimized edit instruction for the client to apply with its own image tool. Provide one or more reference images via `image`. Optional alpha-channel `mask` PNG marks regions to regenerate (opaque=keep, transparent=regenerate). Use for colorization, restyle, multi-reference composition, outfit transfer, inpainting, text translation in image.",
      inputSchema: {
        type: "object",
        properties: {
          ...COMMON_PROPS,
          image: {
            type: "array",
            items: { type: "string" },
            description:
              "One or more reference image paths. Required for the edits endpoint.",
            minItems: 1,
          },
          mask: {
            type: "string",
            description:
              "Alpha-channel PNG mask path (opaque=keep, transparent=regenerate). Requires `image`.",
          },
          input_fidelity: {
            type: "string",
            enum: ["low", "high"],
            description:
              "Edits only. gpt-image-2 rejects this parameter; the server drops it automatically when model is gpt-image-2.",
          },
        },
        required: ["prompt", "image"],
      },
    },
    {
      name: "list_gallery_categories",
      description:
        "List available curated GPT Image 2 prompt-gallery categories bundled with the server. Use before requesting a gallery file to find category-matching design patterns.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_gallery",
      description:
        "Fetch the contents of a specific bundled gallery / craft / cookbook reference markdown file. Pass `name` from `list_gallery_categories`. Use to surface curated prompts and guidance before generation.",
      inputSchema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description:
              "Reference filename without path, e.g. 'gallery.md', 'gallery-anime-and-manga.md', 'craft.md', 'openai-cookbook.md'.",
          },
        },
        required: ["name"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    if (name === "generate_image") {
      const result = await runGenerate(args as unknown as GenerateArgs, server);
      if (Array.isArray(result)) {
        return {
          content: [
            {
              type: "text",
              text: `Generated ${result.length} image(s) via OpenAI API:\n${result.join("\n")}`,
            },
          ],
        };
      }
      // Sampling fallback: return optimized prompt for the host LLM to render with its own image tool
      const a = args as unknown as GenerateArgs;
      const meta = [
        `size: ${resolveSize(a.size ?? DEFAULT_SIZE)}`,
        `quality: ${a.quality ?? "high"}`,
        a.n && a.n > 1 ? `n: ${a.n}` : null,
        a.background ? `background: ${a.background}` : null,
        a.format ? `format: ${a.format}` : null,
      ].filter(Boolean).join(", ");
      return {
        content: [
          {
            type: "text",
            text: `No OPENAI_API_KEY configured on the MCP server. Please render the following image with your client-side image generation tool:\n\nPROMPT:\n${result.prompt}\n\nPARAMETERS: ${meta}`,
          },
        ],
      };
    }
    if (name === "edit_image") {
      const result = await runEdit(args as unknown as EditArgs, server);
      if (Array.isArray(result)) {
        const note = (result as any)._note as string | undefined;
        return {
          content: [
            {
              type: "text",
              text: `${note ? note + "\n" : ""}Wrote ${result.length} image(s) via OpenAI API:\n${result.join("\n")}`,
            },
          ],
        };
      }
      const a = args as unknown as EditArgs;
      return {
        content: [
          {
            type: "text",
            text: `No OPENAI_API_KEY configured on the MCP server. Please render the following edit with your client-side image tool, using the supplied reference images (${a.image.join(", ")}):\n\nPROMPT:\n${result.prompt}`,
          },
        ],
      };
    }
    if (name === "list_gallery_categories") {
      const files = listReferenceFiles();
      return {
        content: [
          {
            type: "text",
            text: files.length
              ? `Available reference files:\n${files.join("\n")}`
              : "No reference files bundled. See https://github.com/wuyoscar/gpt_image_2_skill",
          },
        ],
      };
    }
    if (name === "get_gallery") {
      const fname = String((args as any)?.name ?? "");
      if (!fname || fname.includes("/") || fname.includes("..")) {
        throw new Error("invalid `name`; pass a bare filename");
      }
      const target = path.join(REFERENCES_DIR, fname);
      if (!existsSync(target)) {
        throw new Error(`reference not found: ${fname}`);
      }
      const text = readFileSync(target, "utf8");
      return { content: [{ type: "text", text }] };
    }
    throw new Error(`unknown tool: ${name}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      isError: true,
      content: [{ type: "text", text: `error: ${msg}` }],
    };
  }
});

// ---- Resources: expose every reference markdown as gpt-image://reference/<name> ----
function listReferenceFiles(): string[] {
  if (!existsSync(REFERENCES_DIR)) return [];
  return readdirSync(REFERENCES_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort();
}

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const files = listReferenceFiles();
  return {
    resources: files.map((f) => ({
      uri: `gpt-image://reference/${f}`,
      name: f,
      description: `GPT Image 2 reference: ${f}`,
      mimeType: "text/markdown",
    })),
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  const m = uri.match(/^gpt-image:\/\/reference\/(.+)$/);
  if (!m) throw new Error(`unknown resource uri: ${uri}`);
  const fname = m[1];
  if (fname.includes("/") || fname.includes("..")) {
    throw new Error("invalid resource name");
  }
  const target = path.join(REFERENCES_DIR, fname);
  if (!existsSync(target)) throw new Error(`resource not found: ${fname}`);
  return {
    contents: [
      {
        uri,
        mimeType: "text/markdown",
        text: readFileSync(target, "utf8"),
      },
    ],
  };
});

// ---- Prompts: expose a couple of operating-loop prompts mirroring SKILL.md ----
server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: [
    {
      name: "image_request_runbook",
      description:
        "Operating loop for handling a GPT Image 2 request: classify, search references, refine, confer, then call generate_image / edit_image.",
      arguments: [
        {
          name: "request",
          description: "The user's image request in plain language.",
          required: true,
        },
      ],
    },
  ],
}));

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  if (name !== "image_request_runbook") {
    throw new Error(`unknown prompt: ${name}`);
  }
  const userRequest = (args?.request as string) ?? "";
  const text = `You are handling a GPT Image 2 image request via the gpt-image-2 MCP server.

User request:
"""
${userRequest}
"""

Operating loop:
1. Classify the request: generate / edit / inpaint / multi-reference. Identify asset type, exact text, aspect ratio, references, and quality target.
2. Use the \`list_gallery_categories\` tool, then \`get_gallery\` for the closest 1-2 categories. Read \`**Prompt**\` blocks before choosing a pattern.
3. For dense text, diagrams, UI, data visualization, multi-panel, or weak prompts, also load \`craft.md\`.
4. Confer briefly when ambiguous; otherwise execute.
5. Call \`generate_image\` (no reference images) or \`edit_image\` (with \`image\` and optional \`mask\`).
6. Report back the saved file path(s) and one concise refinement suggestion.

Quality policy: low=draft, medium=exploration, high=final assets, Chinese text, posters, diagrams, UI, paper figures.
Size policy: square=1k, portrait poster, landscape gameplay, 2k print, 4k widescreen, tall vertical/banner.`;
  return {
    description: "GPT Image 2 request runbook",
    messages: [
      {
        role: "user",
        content: { type: "text", text },
      },
    ],
  };
});

  return server;
}

async function startHttpServer(host: string, port: number): Promise<void> {
  const sessions = new Map<string, SSEServerTransport>();

  const httpServer = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? `${host}:${port}`}`);

      if (req.method === "GET" && url.pathname === "/health") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true, transport: "http-sse" }));
        return;
      }

      if (req.method === "GET" && url.pathname === "/sse") {
        const transport = new SSEServerTransport("/message", res);
        sessions.set(transport.sessionId, transport);
        transport.onclose = () => sessions.delete(transport.sessionId);
        transport.onerror = (error) => console.error("sse transport error:", error);
        await createMcpServer().connect(transport);
        return;
      }

      if (req.method === "POST" && url.pathname === "/message") {
        const sessionId = url.searchParams.get("sessionId");
        const transport = sessionId ? sessions.get(sessionId) : undefined;
        if (!transport) {
          res.writeHead(404).end("Unknown or missing sessionId");
          return;
        }
        await transport.handlePostMessage(req, res);
        return;
      }

      res.writeHead(404).end("Not found. Use GET /sse for MCP over SSE, POST /message?sessionId=..., or GET /health.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("http transport error:", err);
      if (!res.headersSent) res.writeHead(500);
      res.end(msg);
    }
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(port, host, () => resolve());
  });

  console.error(`gpt-image-2-mcp server ready (http+sse http://${host}:${port}/sse)`);
}

// ---- main ----
async function main() {
  const config = parseRuntimeConfig(process.env);
  if (config.transport === "http") {
    await startHttpServer(config.host, config.port);
    return;
  }

  const transport = new StdioServerTransport();
  await createMcpServer().connect(transport);
  console.error("gpt-image-2-mcp server ready (stdio)");
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
