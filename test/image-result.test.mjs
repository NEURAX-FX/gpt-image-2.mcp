import assert from "node:assert/strict";
import test from "node:test";

import { buildImageToolContent, resolveImageReturnMode } from "../dist/image-result.js";

const ONE_BY_ONE_PNG = "iVBORw0KGgo=";

test("defaults to returning MCP image content when no file is requested", () => {
  assert.equal(resolveImageReturnMode({}), "image");
});

test("defaults to file mode when a file path is requested", () => {
  assert.equal(resolveImageReturnMode({ file: "out.png" }), "file");
});

test("builds image content by default instead of file paths", () => {
  const content = buildImageToolContent({
    operation: "generate",
    returnMode: "image",
    images: [{ data: ONE_BY_ONE_PNG, mimeType: "image/png" }],
    paths: [],
  });

  assert.deepEqual(content, [
    { type: "image", data: ONE_BY_ONE_PNG, mimeType: "image/png" },
  ]);
});

test("builds both image content and file path text when requested", () => {
  const content = buildImageToolContent({
    operation: "edit",
    returnMode: "both",
    images: [{ data: ONE_BY_ONE_PNG, mimeType: "image/png" }],
    paths: ["/tmp/out.png"],
    note: "note: dropped input_fidelity",
  });

  assert.equal(content.length, 2);
  assert.deepEqual(content[0], {
    type: "text",
    text: "note: dropped input_fidelity\nWrote 1 image(s):\n/tmp/out.png",
  });
  assert.deepEqual(content[1], {
    type: "image",
    data: ONE_BY_ONE_PNG,
    mimeType: "image/png",
  });
});
