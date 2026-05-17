export type TransportMode = "stdio" | "http";

export interface RuntimeConfig {
  transport: TransportMode;
  host: string;
  port: number;
}

export function parseRuntimeConfig(env: NodeJS.ProcessEnv): RuntimeConfig {
  const transport = (env.MCP_TRANSPORT ?? "stdio").toLowerCase();
  if (transport !== "stdio" && transport !== "http") {
    throw new Error("MCP_TRANSPORT must be one of: stdio, http");
  }

  const rawPort = env.MCP_PORT ?? "3333";
  const port = Number.parseInt(rawPort, 10);
  if (!Number.isInteger(port) || String(port) !== rawPort || port < 1 || port > 65535) {
    throw new Error("MCP_PORT must be an integer between 1 and 65535");
  }

  return {
    transport,
    host: env.MCP_HOST ?? "127.0.0.1",
    port,
  };
}
