# Snip Backend

A zero-dependency Bun URL shortener. Requires Bun 1.x.

```sh
bun start
```

The server listens on port `3000` by default. Set `PORT` to change it, `BASE_URL` to control generated short links, or `RAILWAY_PUBLIC_DOMAIN` to use `https://<domain>` when `BASE_URL` is unset. Short links otherwise use `http://localhost:<PORT>`.

## API

- `POST /api/links` with `{"url":"https://example.com"}` creates a link.
- `GET /api/links` lists links.
- `GET /:code` redirects to the original URL and increments its hit count.

Invalid JSON and non-HTTP(S) URLs return `400`; unknown codes return `404`. Links are kept in memory and are cleared when the server restarts.

Set `PUBLIC_DIR` to serve files from a directory as well. `/` serves `index.html`; existing files are served before short-code redirects.