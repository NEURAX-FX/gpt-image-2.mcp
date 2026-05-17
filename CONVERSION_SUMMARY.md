# GPT Image 2 MCP Conversion Summary

## What Was Done

Successfully converted the [gpt_image_2_skill](https://github.com/wuyoscar/gpt_image_2_skill) project from a Python CLI + agent skill to a Model Context Protocol (MCP) server.

## Project Structure

```
/root/gpt-image-2.mcp/
├── src/
│   └── index.ts              # Main MCP server implementation
├── dist/                     # Compiled JavaScript output
├── references/               # 34 curated prompt gallery markdown files
├── package.json              # Node.js dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── README.md                 # Full documentation
├── QUICKSTART.md             # Quick start guide
├── LICENSE                   # MIT license
├── .env.example              # Environment variable template
└── .gitignore                # Git ignore rules
```

## MCP Server Features

### Tools (4)
1. **`generate_image`** — Text-to-image generation via OpenAI GPT Image 2
   - Supports all official parameters: size, quality, n, background, moderation, format, compression
   - Size shortcuts: 1k, 2k, 4k, portrait, landscape, square, wide, tall

2. **`edit_image`** — Reference-image editing and inpainting
   - Multi-reference support (outfit transfer, brand collabs, etc.)
   - Alpha-channel mask inpainting
   - Auto-drops incompatible parameters for gpt-image-2

3. **`list_gallery_categories`** — List 34 bundled prompt galleries

4. **`get_gallery`** — Fetch specific gallery markdown content

### Resources
All 34 reference markdown files exposed as MCP resources with URIs:
- `gpt-image://reference/gallery.md`
- `gpt-image://reference/gallery-anime-and-manga.md`
- `gpt-image://reference/craft.md`
- And 31 more categories

### Prompts
- **`image_request_runbook`** — Operating loop for handling image requests with best practices

## Key Improvements Over Original

1. **Native MCP Integration** — No need for CLI wrappers or subprocess calls
2. **Resource Exposure** — All prompt galleries accessible as MCP resources
3. **Structured Prompts** — Built-in runbook for optimal image generation workflow
4. **Type Safety** — Full TypeScript implementation with proper types
5. **Better Error Handling** — Graceful API error surfacing
6. **Auto-configuration** — Reads OPENAI_API_KEY from env/.env/~/.env chain

## Installation

```bash
cd /root/gpt-image-2.mcp
npm install
# Build happens automatically via prepare script
```

## Usage with Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "gpt-image-2": {
      "command": "node",
      "args": ["/root/gpt-image-2.mcp/dist/index.js"],
      "env": {
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

## Testing

Server builds and starts successfully:
```bash
$ node dist/index.js
gpt-image-2-mcp server ready (stdio)
```

## Gallery Categories Included

34 curated prompt galleries:
- Anime and manga
- Architecture and interior
- Beauty and lifestyle
- Brand systems and identity
- Character design
- Cinematic and animation
- Data visualization
- Edit endpoint showcase
- Fashion editorial
- Fine art painting
- Gaming
- Illustration (multiple styles)
- Infographics and field guides
- Chinese ink and calligraphy
- Isometric design
- Maps and cartography
- Photography
- Posters and typography
- Research figures
- Tattoo design
- UI mockups
- And more...

## Technical Details

- **Language**: TypeScript → JavaScript (ES2022, Node16 modules)
- **MCP SDK**: @modelcontextprotocol/sdk ^0.5.0
- **OpenAI SDK**: openai ^4.0.0
- **Node Version**: ≥18.0.0
- **Transport**: stdio (standard MCP transport)

## Next Steps

1. **Publish to npm** (optional):
   ```bash
   npm publish
   ```

2. **Create GitHub repository** and push:
   ```bash
   git remote add origin https://github.com/wuyoscar/gpt-image-2.mcp.git
   git push -u origin main
   ```

3. **Test with Claude Desktop** using the config above

4. **Add to MCP server registry** for discoverability

## Files Ready for Deployment

- ✅ TypeScript source compiled to dist/
- ✅ All 34 reference galleries bundled
- ✅ README.md with full documentation
- ✅ QUICKSTART.md for quick setup
- ✅ package.json with proper metadata
- ✅ .env.example for configuration template
- ✅ LICENSE (MIT)
- ✅ .gitignore configured

## Cost Warning

Remind users that API calls bill their OpenAI account:
- `low` quality: ~$0.02-0.04 per image
- `medium` quality: ~$0.20-0.40 per image
- `high` quality: ~$2-4 per image

Use `low` for drafts, `high` for final assets.
