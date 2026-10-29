import { stat } from "node:fs/promises";
import { resolve, sep } from "node:path";

const port = Number(process.env.PORT || 3000);
const publicDir = process.env.PUBLIC_DIR ? resolve(process.env.PUBLIC_DIR) : null;
const baseUrl = (
  process.env.BASE_URL?.trim() ||
  (process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : `http://localhost:${port}`)
).replace(/\/+$/, "");

const links = new Map();
const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function createCode() {
  let code;
  do {
    code = Array.from(
      { length: 6 },
      () => alphabet[Math.floor(Math.random() * alphabet.length)],
    ).join("");
  } while (links.has(code));
  return code;
}

async function serveStatic(pathname) {
  if (!publicDir) return null;

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const filePath = decodedPath === "/"
    ? resolve(publicDir, "index.html")
    : resolve(publicDir, `.${decodedPath}`);
  if (filePath !== publicDir && !filePath.startsWith(`${publicDir}${sep}`)) {
    return null;
  }

  try {
    if (!(await stat(filePath)).isFile()) return null;
  } catch {
    return null;
  }

  return new Response(Bun.file(filePath), { headers: corsHeaders });
}

Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (pathname === "/api/links" && request.method === "POST") {
      let payload;
      try {
        payload = await request.json();
      } catch {
        return jsonResponse({ error: "Invalid JSON" }, 400);
      }

      if (typeof payload?.url !== "string") {
        return jsonResponse({ error: "A valid http(s) URL is required" }, 400);
      }

      let target;
      try {
        target = new URL(payload.url);
      } catch {
        return jsonResponse({ error: "A valid http(s) URL is required" }, 400);
      }
      if (target.protocol !== "http:" && target.protocol !== "https:") {
        return jsonResponse({ error: "A valid http(s) URL is required" }, 400);
      }

      const link = {
        code: createCode(),
        url: target.href,
        shortUrl: "",
        hits: 0,
        createdAt: new Date().toISOString(),
      };
      link.shortUrl = `${baseUrl}/${link.code}`;
      links.set(link.code, link);
      return jsonResponse(link, 201);
    }

    if (pathname === "/api/links" && request.method === "GET") {
      return jsonResponse(Array.from(links.values()));
    }

    if (request.method === "GET") {
      const staticResponse = await serveStatic(pathname);
      if (staticResponse) return staticResponse;

      const code = pathname.slice(1);
      const link = code && !code.includes("/") ? links.get(code) : null;
      if (!link) return jsonResponse({ error: "Not found" }, 404);

      link.hits += 1;
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: link.url },
      });
    }

    return jsonResponse({ error: "Not found" }, 404);
  },
});

console.log(`Snip backend listening on ${baseUrl}`);