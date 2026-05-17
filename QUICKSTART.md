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

Create a `.env` file with your OpenAI API key:

```bash
cp .env.example .env
# Edit .env and add: OPENAI_API_KEY=sk-...
```

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

The default HTTP endpoint is `http://127.0.0.1:3333/sse`. Override it with `MCP_HOST` and `MCP_PORT`:

```bash
MCP_TRANSPORT=http MCP_HOST=0.0.0.0 MCP_PORT=8080 node dist/index.js
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

**"OPENAI_API_KEY not set"**
- Ensure your `.env` file exists and contains the key
- Or set it in the MCP server config's `env` section

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
