# GPT Image 2 MCP Server

MCP (Model Context Protocol) server for OpenAI GPT Image 2 image generation and editing, with a curated prompt gallery.

Converted from [wuyoscar/gpt_image_2_skill](https://github.com/wuyoscar/gpt_image_2_skill).

## Features

- **Tools**:
  - `generate_image` — Text-to-image via `/v1/images/generations`
  - `edit_image` — Reference-image editing/inpainting via `/v1/images/edits`
  - `list_gallery_categories` — List bundled prompt-gallery categories
  - `get_gallery` — Fetch specific gallery/craft/cookbook reference markdown

- **Resources**: All bundled reference markdown files exposed as `gpt-image://reference/<name>`

- **Prompts**: `image_request_runbook` — Operating loop for handling image requests

- **Bundled References**: 30+ curated prompt galleries covering anime, architecture, brand systems, character design, cinematic, data visualization, fashion, gaming, illustration, infographics, Chinese ink, isometric, maps, photography, posters, research figures, tattoo design, typography, UI mockups, and more.

## Installation

### Prerequisites

- Node.js ≥ 18
- OpenAI API key with GPT Image 2 access

### Install via npm

```bash
npm install -g gpt-image-2-mcp
```

### Install from source

```bash
git clone https://github.com/wuyoscar/gpt-image-2.mcp.git
cd gpt-image-2.mcp
npm install
npm run build
npm link  # optional: make globally available
```

## Configuration

Set your OpenAI API key via environment variable, `.env`, or `~/.env`:

```bash
export OPENAI_API_KEY=sk-...
```

Or create `.env` in your working directory:

```bash
cp .env.example .env
# edit .env and add your key
```

The server reads `OPENAI_API_KEY` from process env first, then `./.env`, then `~/.env` (without overriding existing env).

## Usage

### With Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "gpt-image-2": {
      "command": "node",
      "args": ["/path/to/gpt-image-2.mcp/dist/index.js"],
      "env": {
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

Or if installed globally:

```json
{
  "mcpServers": {
    "gpt-image-2": {
      "command": "gpt-image-2-mcp"
    }
  }
}
```

### With other MCP clients

Run the server via stdio transport, which is the default and most compatible mode:

```bash
node dist/index.js
```

Or if installed globally:

```bash
gpt-image-2-mcp
```

Run as a local HTTP MCP server when your client supports MCP over SSE:

```bash
MCP_TRANSPORT=http node dist/index.js
```

Defaults: `http://127.0.0.1:3333/sse`. Override with `MCP_HOST` and `MCP_PORT`:

```bash
MCP_TRANSPORT=http MCP_HOST=0.0.0.0 MCP_PORT=8080 node dist/index.js
```

HTTP endpoints:
- `GET /sse` — MCP SSE connection endpoint
- `POST /message?sessionId=...` — JSON-RPC message endpoint advertised by SSE
- `GET /health` — local health check

## Tools

### `generate_image`

Text-to-image generation.

**Parameters**:
- `prompt` (required): Text prompt
- `file`: Output path (auto-generated if omitted)
- `model`: Model ID (default `gpt-image-2`)
- `size`: Canvas size — literal (`1024x1024`, `1536x1024`, `2048x2048`, `3840x2160`) or shortcut (`1k`, `2k`, `4k`, `portrait`, `landscape`, `square`, `wide`, `tall`)
- `quality`: `low` | `medium` | `high` | `auto` (default `high`)
- `n`: Number of images (default 1)
- `background`: `auto` | `opaque`
- `moderation`: `auto` | `low` (default `low`)
- `format`: `png` | `jpeg` | `webp`
- `compression`: 0-100 (jpeg/webp only)
- `user`: Optional end-user identifier

**Example**:
```json
{
  "prompt": "a cat astronaut on the moon",
  "size": "1k",
  "quality": "high"
}
```

### `edit_image`

Reference-image editing and inpainting.

**Parameters**:
- `prompt` (required): Edit instruction
- `image` (required): Array of reference image paths
- `mask`: Alpha-channel PNG mask path (opaque=keep, transparent=regenerate)
- `file`: Output path
- `model`, `size`, `quality`, `n`, `background`, `format`, `compression`, `user`: Same as `generate_image`
- `input_fidelity`: `low` | `high` (auto-dropped for gpt-image-2)

**Example**:
```json
{
  "prompt": "colorize this manga page",
  "image": ["page.jpg"],
  "size": "portrait",
  "quality": "high"
}
```

**Multi-reference example**:
```json
{
  "prompt": "77 × KFC collab poster",
  "image": ["cat.png", "kfc_logo.png"],
  "size": "2k"
}
```

**Inpaint example**:
```json
{
  "prompt": "replace sky with aurora",
  "image": ["photo.jpg"],
  "mask": "sky_mask.png"
}
```

### `list_gallery_categories`

List available bundled reference markdown files.

**Example response**:
```
Available reference files:
craft.md
gallery-anime-and-manga.md
gallery-architecture-and-interior.md
gallery-beauty-and-lifestyle.md
...
```

### `get_gallery`

Fetch a specific reference file's contents.

**Parameters**:
- `name` (required): Filename from `list_gallery_categories`

**Example**:
```json
{
  "name": "gallery-anime-and-manga.md"
}
```

## Resources

All bundled reference markdown files are exposed as MCP resources with URIs like:

```
gpt-image://reference/gallery.md
gpt-image://reference/gallery-anime-and-manga.md
gpt-image://reference/craft.md
gpt-image://reference/openai-cookbook.md
```

MCP clients can list and read these resources directly.

## Prompts

### `image_request_runbook`

Operating loop for handling GPT Image 2 requests.

**Arguments**:
- `request` (required): User's image request in plain language

**Workflow**:
1. Classify request (generate/edit/inpaint/multi-reference)
2. Search bundled references for matching patterns
3. Refine with craft guidance for text-heavy/UI/diagram requests
4. Execute via `generate_image` or `edit_image`
5. Report saved paths and refinement suggestions

## Quality Policy

- `low`: Cheap drafts, broad exploration, many variants
- `medium`: Normal exploration, style probing, balanced cost
- `high`: Final assets, Chinese text, posters, diagrams, UI, paper figures, dense labels

## Size Policy

- `1k` / `square`: Default/social square (1024×1024)
- `portrait`: Poster/mobile/beauty (1024×1536)
- `landscape`: Landscape/gameplay/photo (1536×1024)
- `2k`: Print/paper figure (2048×2048)
- `4k`: Widescreen hero (3840×2160)
- `wide`: Widescreen (2048×1152)
- `tall`: Vertical story/banner (2160×3840)

## Cost Notes

- API calls bill your OpenAI account
- Quality scales cost ~10× per step (low → medium → high)
- Use `low` for drafts, `medium` for exploration, `high` for shipping

## Development

```bash
npm install
npm run build    # compile TypeScript
npm run dev      # watch mode
```

## License

MIT — see [LICENSE](LICENSE)

## Credits

Original project: [wuyoscar/gpt_image_2_skill](https://github.com/wuyoscar/gpt_image_2_skill)

Prompt gallery curated by [@wuyoscar](https://github.com/wuyoscar).
