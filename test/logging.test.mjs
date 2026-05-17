import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { createLogger, summarizeToolArgs } from "../dist/logger.js";

test("debug logger writes structured stderr lines", () => {
  const lines = [];
  const logger = createLogger("debug", (line) => lines.push(line));

  logger.debug("tool.start", { tool: "generate_image", size: "1024x1024" });

  assert.equal(lines.length, 1);
  assert.match(lines[0], /\[debug\] tool\.start/);
  assert.match(lines[0], /"tool":"generate_image"/);
  assert.match(lines[0], /"size":"1024x1024"/);
});

test("info logger suppresses debug lines", () => {
  const lines = [];
  const logger = createLogger("info", (line) => lines.push(line));

  logger.debug("tool.start", { tool: "generate_image" });
  logger.info("server.ready", { transport: "stdio" });

  assert.equal(lines.length, 1);
  assert.match(lines[0], /\[info\] server\.ready/);
});

test("tool argument summaries omit full prompts and sensitive values", () => {
  const summary = summarizeToolArgs("generate_image", {
    prompt: "this prompt should not be logged in full",
    size: "1k",
    quality: "high",
    n: 2,
    OPENAI_API_KEY: "sk-secret",
  });

  assert.equal(summary.promptChars, 40);
  assert.equal(summary.size, "1k");
  assert.equal(summary.quality, "high");
  assert.equal(summary.n, 2);
  assert.equal("prompt" in summary, false);
  assert.equal("OPENAI_API_KEY" in summary, false);
});

test("generate_image debug logs include handoff mode and omit full prompt", () => {
  const prompt = "a private prompt that must not appear verbatim in stderr";
  const messages = [
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test", version: "1.0" },
      },
    },
    { jsonrpc: "2.0", method: "notifications/initialized" },
    {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "generate_image",
        arguments: { prompt, size: "1k", quality: "high" },
      },
    },
  ];

  const child = spawnSync(process.execPath, ["dist/index.js"], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, OPENAI_API_KEY: "", LOG_LEVEL: "debug" },
    input: messages.map((m) => JSON.stringify(m)).join("\n") + "\n",
    encoding: "utf8",
  });

  assert.equal(child.status, 0, child.stderr);
  assert.match(child.stderr, /tool\.start/);
  assert.match(child.stderr, /tool\.handoff/);
  assert.match(child.stderr, /tool\.success/);
  assert.match(child.stderr, /"mode":"handoff"/);
  assert.doesNotMatch(child.stderr, new RegExp(prompt));
});
