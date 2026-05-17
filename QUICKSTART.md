# GPT Image 2 MCP Server - Quick Start

## Installation

```bash
# Clone the repository
git clone https://github.com/wuyoscar/gpt-image-2.mcp.git
cd gpt-image-2.mcp

# Install dependencies and build
npm install

# The build happens automatically via the prepare script
```

## Configuration

Optional: create a `.env` file with your OpenAI API key if you want this MCP server to call OpenAI directly:

```bash
cp .env.example .env
# Edit .env and add: OPENAI_API_KEY=sk-...
```

Without `OPENAI_API_KEY`, image tools return a machine-readable `image_model_handoff` JSON payload. Your MCP host should let the chat model refine/route the prompt, then forward the payload to an actual image generation or image editing model.

With `OPENAI_API_KEY`, generated images are returned as MCP `image` content by default. Use `return: "file"` or pass `file` if you want images written to disk instead; use `return: "both"` to get file paths plus inline image content.

Logging is controlled with `LOG_LEVEL`:

```bash
LOG_LEVEL=debug   # default, verbose structured stderr logs
LOG_LEVEL=info    # startup, success, and error logs only
LOG_LEVEL=silent  # suppress routine logs
```

Logs are safe for stdio transport because they go to stderr. Full prompts and secrets are not logged.

## Test the Server

```bash
# Start the server in stdio mode, the default and most compatible mode
node dist/index.js
```

You should see: `gpt-image-2-mcp server ready (stdio)`

For local HTTP/SSE clients:

```bash
MCP_TRANSPORT=http node dist/index.js
```

The default HTTP endpoint is `http://127.0.0.1:3333`. Override it with `MCP_HOST` and `MCP_PORT`:

```bash
MCP_TRANSPORT=http MCP_HOST=0.0.0.0 MCP_PORT=8080 node dist/index.js
```

## Test the Provider Directly

Use the executable curl script to bypass MCP and call `/images/generations` directly:

```bash
npm run image:curl
```

By default it reads `/etc/gpt-image-mcp.env`, prints the raw JSON response, and saves the first image to `fig/curl-test-image.png`.

```bash
scripts/generate-image-curl.sh --mode json
scripts/generate-image-curl.sh --mode image --output fig/apple.png
scripts/generate-image-curl.sh --prompt "A studio photo of a red apple" --quality low
```

## Use with Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "gpt-image-2": {
      "command": "node",
      "args": ["/absolute/path/to/gpt-image-2.mcp/dist/index.js"],
      "env": {
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

Restart Claude Desktop.

## Example Usage in Claude

Once configured, you can ask Claude:

- "Generate a cat astronaut on the moon"
- "List available prompt gallery categories"
- "Show me anime and manga prompts from the gallery"
- "Edit this image to colorize it" (with image attachment)
- "Create a Chinese tea poster in 2k resolution with high quality"

## Available Tools

- `generate_image` — Text-to-image generation
- `edit_image` — Reference-image editing/inpainting
- `list_gallery_categories` — List bundled prompt galleries
- `get_gallery` — Fetch specific gallery markdown

## Available Resources

All reference markdown files are exposed as MCP resources:
- `gpt-image://reference/gallery.md`
- `gpt-image://reference/gallery-anime-and-manga.md`
- `gpt-image://reference/craft.md`
- And 30+ more categories

## Troubleshooting

**No image file appears**
- If `OPENAI_API_KEY` is set, this is expected by default: the tool returns MCP image content. Use `return: "file"` or `file` to write to disk.
- If `OPENAI_API_KEY` is not set, this is expected: the tool returns `image_model_handoff` JSON for your MCP host to forward to an image model.

**"command not found: node"**
- Install Node.js ≥ 18 from https://nodejs.org

**Server doesn't start**
- Run `npm run build` to recompile
- Check `dist/index.js` exists

**Images not generating**
- Verify your OpenAI API key has GPT Image 2 access
- Check OpenAI API status
- Review error messages in Claude Desktop logs

## Development

```bash
# Watch mode for development
npm run dev

# Manual build
npm run build
```

## Cost Warning

All API calls bill your OpenAI account. Quality settings affect cost:
- `low`: ~$0.02-0.04 per image
- `medium`: ~$0.20-0.40 per image  
- `high`: ~$2-4 per image

Use `low` for drafts, `high` for final assets.
