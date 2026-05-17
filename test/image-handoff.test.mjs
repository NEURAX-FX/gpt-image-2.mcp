import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

function callTool(name, args) {
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
      params: { name, arguments: args },
    },
  ];

  const child = spawnSync(process.execPath, ["dist/index.js"], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, OPENAI_API_KEY: "" },
    input: messages.map((m) => JSON.stringify(m)).join("\n") + "\n",
    encoding: "utf8",
  });

  assert.equal(child.status, 0, child.stderr);
  const responses = child.stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  return responses.find((r) => r.id === 2);
}

test("generate_image without API key returns machine-readable image handoff", () => {
  const response = callTool("generate_image", {
    prompt: "a red apple on a wooden table",
    size: "1k",
    quality: "high",
  });

  assert.equal(response.result.isError, undefined);
  const payload = JSON.parse(response.result.content[0].text);
  assert.equal(payload.type, "image_model_handoff");
  assert.equal(payload.operation, "generate");
  assert.equal(payload.target_model_class, "image_generation");
  assert.equal(payload.prompt, "a red apple on a wooden table");
  assert.deepEqual(payload.parameters, {
    size: "1024x1024",
    quality: "high",
    n: 1,
    format: "png",
  });
});

test("edit_image without API key returns machine-readable image edit handoff", () => {
  const response = callTool("edit_image", {
    prompt: "make the sky sunset orange",
    image: ["photo.png"],
    size: "landscape",
  });

  assert.equal(response.result.isError, undefined);
  const payload = JSON.parse(response.result.content[0].text);
  assert.equal(payload.type, "image_model_handoff");
  assert.equal(payload.operation, "edit");
  assert.equal(payload.target_model_class, "image_editing");
  assert.equal(payload.prompt, "make the sky sunset orange");
  assert.deepEqual(payload.reference_images, ["photo.png"]);
  assert.equal(payload.parameters.size, "1536x1024");
});
