# Obsidian API

A REST API plugin for [Obsidian](https://obsidian.md) — clean replacement for `obsidian-local-rest-api` with extended endpoints and secure-by-default design.

Compatible with [obsidian-mcp-tools](https://github.com/anthropics/obsidian-mcp-tools) for Claude Code integration.

## Features

- **Full REST API** — CRUD on vault files, active file, periodic notes
- **Extended endpoints** — tags, tasks, backlinks, links, outline, properties
- **Search** — simple text, Dataview DQL, JsonLogic, semantic (via Smart Connections)
- **Templates** — Templater integration
- **PATCH engine** — built on Obsidian's `metadataCache` for accurate heading/block/frontmatter targeting
- **Dual-mode PATCH** — JSON body (preferred) or HTTP headers (backward-compatible)
- **HTTPS** — self-signed certificate with configurable SANs
- **Extension API** — third-party plugins can register custom routes
- **Constant-time auth** — timing-safe API key comparison

## Installation

### Manual

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/vigeron/obsidian-api/releases)
2. Create folder `.obsidian/plugins/obsidian-api/` in your vault
3. Copy the files into that folder
4. Enable the plugin in Obsidian Settings → Community Plugins

### Development

```bash
git clone https://github.com/vigeron/obsidian-api.git
cd obsidian-api
npm install
npm run dev
```

## Configuration

Open Obsidian Settings → Obsidian API:

| Setting | Default | Description |
|---------|---------|-------------|
| HTTPS Port | 27124 | Secure server port |
| HTTP Port | 27123 | Insecure server port (disabled by default) |
| Binding Host | 127.0.0.1 | Network interface to bind |
| CORS Origin | * | Allowed CORS origins |

## API Reference

### Authentication

All endpoints (except `GET /` and `GET /obsidian-api.crt`) require a Bearer token:

```
Authorization: Bearer <your-api-key>
```

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Server info and auth status |
| GET | `/obsidian-api.crt` | Download HTTPS certificate |
| GET/PUT/POST/PATCH/DELETE | `/vault/*` | File and directory operations |
| GET/PUT/POST/PATCH/DELETE | `/active/` | Active file operations |
| GET/PUT/POST/PATCH/DELETE | `/periodic/:period/` | Periodic notes |
| POST | `/search/` | DQL or JsonLogic search |
| POST | `/search/simple/` | Simple text search |
| POST | `/search/smart` | Semantic search (requires Smart Connections) |
| GET | `/commands/` | List commands |
| POST | `/commands/:id/` | Execute command |
| POST | `/open/*` | Open file in Obsidian UI |
| GET | `/tags/` | List all tags with counts |
| GET | `/tags/:tag` | Files with specific tag |
| GET | `/tasks/` | List tasks across vault |
| PATCH | `/tasks/` | Toggle task status |
| GET | `/backlinks/*` | Backlinks for a file |
| GET | `/links/*` | Outgoing links from a file |
| GET | `/outline/*` | Heading outline for a file |
| GET | `/properties/` | All frontmatter properties |
| GET/PUT/DELETE | `/properties/*` | File frontmatter CRUD |
| POST | `/templates/execute` | Execute Templater template |

### PATCH Format

**JSON body (preferred):**

```json
{
  "operation": "append",
  "targetType": "heading",
  "target": "Section::Subsection",
  "content": "New content\n",
  "targetDelimiter": "::",
  "createTargetIfMissing": true
}
```

**HTTP headers (backward-compatible):**

```
Operation: append
Target-Type: heading
Target: Section%3A%3ASubsection
Content-Type: text/markdown
```

### Content Negotiation

Use the `Accept` header to control response format:

| Accept Header | Response |
|--------------|----------|
| `application/vnd.olrapi.note+json` | Full file metadata (tags, frontmatter, stat, content) |
| `application/vnd.olrapi.document-map+json` | Document structure (headings, blocks, frontmatter fields) |
| `*/*` (default) | Raw file content |

## Extension API

Third-party plugins can register custom routes:

```typescript
const api = app.plugins.plugins["obsidian-api"]?.getPublicApi(manifest);
if (api) {
  api.addRoute("/my-endpoint/")
    .get((req, res) => {
      api.sendSuccess(res, { hello: "world" });
    });
}
```

## Network Usage

This plugin starts a **local HTTP/HTTPS server** on your machine (default: `127.0.0.1`). It does **not** connect to any external services or send data over the internet.

The server listens only on the configured binding host and port, accepting REST API requests from local clients (e.g. MCP tools, scripts, browser extensions). All communication stays on your machine unless you explicitly change the binding host to a non-loopback address.

Optional integrations (Smart Connections, Dataview, Templater) communicate only with locally installed Obsidian plugins — no network requests are made on their behalf.

## Security

- API key generated with cryptographic random bytes (SHA-256)
- Constant-time token comparison (prevents timing attacks)
- Self-signed HTTPS certificate (2048-bit RSA, SHA-256)
- Configurable CORS origin
- Error responses never expose internal details (stack traces, file paths)
- Settings UI uses Obsidian Setting API (no innerHTML)

## License

[MIT](LICENSE)


## Support
If this plugin is useful to you and you'd like to support further development, you can do so on Ko-fi.

<a href='https://ko-fi.com/O4O11VQFK1' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://storage.ko-fi.com/cdn/kofi6.png?v=6' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>