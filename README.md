# Obsidian API

A REST API plugin for [Obsidian](https://obsidian.md) with clean architecture, extended endpoints, and a secure-by-default design.

## Features

- **Full REST API** — CRUD operations on vault files, active file, periodic notes
- **Search** — Dataview DQL, JsonLogic, and simple text search
- **Commands** — List and execute Obsidian commands
- **PATCH engine** — Built on Obsidian's `metadataCache` for accurate heading/block/frontmatter targeting
- **Dual-mode PATCH** — JSON body (preferred) or HTTP headers (backward-compatible)
- **HTTPS** — Self-signed certificate with configurable SANs
- **Extension API** — Third-party plugins can register custom routes
- **Constant-time auth** — Timing-safe API key comparison

## Installation

### Manual

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/your-username/obsidian-api/releases)
2. Create folder `.obsidian/plugins/obsidian-api/` in your vault
3. Copy the files into that folder
4. Enable the plugin in Obsidian Settings → Community Plugins

### Development

```bash
git clone https://github.com/your-username/obsidian-api.git
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
| GET | `/commands/` | List commands |
| POST | `/commands/:id/` | Execute command |
| POST | `/open/*` | Open file in Obsidian UI |

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

## Security

- API key generated with cryptographic random bytes (SHA-256)
- Constant-time token comparison (prevents timing attacks)
- Self-signed HTTPS certificate (2048-bit RSA, SHA-256)
- Configurable CORS origin
- Error responses never expose internal details (stack traces, file paths)
- Settings UI uses Obsidian Setting API (no innerHTML)

## License

[MIT](LICENSE)
