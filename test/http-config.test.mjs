import assert from "node:assert/strict";
import test from "node:test";

import { parseRuntimeConfig } from "../dist/runtime-config.js";

test("defaults to stdio with localhost HTTP settings", () => {
  assert.deepEqual(parseRuntimeConfig({}), {
    transport: "stdio",
    host: "127.0.0.1",
    port: 3333,
  });
});

test("enables HTTP transport from environment", () => {
  assert.deepEqual(
    parseRuntimeConfig({
      MCP_TRANSPORT: "http",
      MCP_HOST: "0.0.0.0",
      MCP_PORT: "8080",
    }),
    {
      transport: "http",
      host: "0.0.0.0",
      port: 8080,
    },
  );
});

test("rejects invalid HTTP ports", () => {
  assert.throws(
    () => parseRuntimeConfig({ MCP_TRANSPORT: "http", MCP_PORT: "70000" }),
    /MCP_PORT must be an integer between 1 and 65535/,
  );
});

test("rejects unknown transports", () => {
  assert.throws(
    () => parseRuntimeConfig({ MCP_TRANSPORT: "websocket" }),
    /MCP_TRANSPORT must be one of: stdio, http/,
  );
});
