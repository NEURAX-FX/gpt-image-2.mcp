export type LogLevel = "debug" | "info" | "silent";

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  silent: 100,
};

export interface Logger {
  debug(event: string, fields?: Record<string, unknown>): void;
  info(event: string, fields?: Record<string, unknown>): void;
  error(event: string, fields?: Record<string, unknown>): void;
}

export function parseLogLevel(value: string | undefined): LogLevel {
  const normalized = (value ?? "debug").toLowerCase();
  if (normalized === "debug" || normalized === "info" || normalized === "silent") {
    return normalized;
  }
  return "debug";
}

export function createLogger(
  level: LogLevel = parseLogLevel(process.env.LOG_LEVEL),
  write: (line: string) => void = (line) => console.error(line),
): Logger {
  function emit(kind: "debug" | "info" | "error", event: string, fields: Record<string, unknown> = {}) {
    if (kind !== "error" && LEVEL_RANK[level] > LEVEL_RANK[kind]) return;
    if (kind === "error" && level === "silent") return;

    const payload = sanitizeFields(fields);
    write(`${new Date().toISOString()} [${kind}] ${event} ${JSON.stringify(payload)}`);
  }

  return {
    debug: (event, fields) => emit("debug", event, fields),
    info: (event, fields) => emit("info", event, fields),
    error: (event, fields) => emit("error", event, fields),
  };
}

export function summarizeToolArgs(
  name: string,
  args: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const input = args ?? {};
  const prompt = typeof input.prompt === "string" ? input.prompt : "";
  const images = Array.isArray(input.image) ? input.image : [];

  return sanitizeFields({
    tool: name,
    promptChars: prompt.length,
    model: input.model,
    size: input.size,
    quality: input.quality,
    n: input.n,
    background: input.background,
    format: input.format,
    compression: input.compression,
    moderation: input.moderation,
    hasMask: Boolean(input.mask),
    imageCount: images.length || undefined,
  });
}

export function errorSummary(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return { error: err.message, errorName: err.name };
  }
  return { error: String(err) };
}

function sanitizeFields(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    if (/api[_-]?key|token|secret|authorization/i.test(key)) continue;
    if (key === "prompt" || key === "b64_json" || key === "data") continue;
    out[key] = value;
  }
  return out;
}
