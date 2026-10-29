# Snip: One Backend, Two Clients

Snip is a tiny URL shortener that demonstrates a multi-project Git repository. One Bun backend serves the same API to an Angular web app and a Node.js CLI. Links live in an in-memory `Map`, so restarting the backend clears them.

## Projects and branches

Each project lives at the root of its own orphan branch. The `main` branch is the superproject: its folders are submodules that pin specific commits from those branches.

| Folder | Branch | Stack | Purpose |
| --- | --- | --- | --- |
| `backend/` | `backend` | Bun, zero dependencies | API and short-link redirects |
| `frontend/` | `frontend` | Angular 19 | Web interface |
| `cli/` | `cli` | Node.js, zero dependencies | Terminal client |

## API contract

The backend listens on `http://localhost:3000` by default.

| Method | Path | Request | Response |
| --- | --- | --- | --- |
| `POST` | `/api/links` | `{"url":"https://example.com"}` | `201` with `{ code, url, shortUrl, hits, createdAt }`; `400` for invalid JSON or a non-HTTP(S) URL |
| `GET` | `/api/links` | — | `200` with an array of links in the same shape |
| `GET` | `/:code` | — | `302` to the original URL and increments `hits`; `404` for an unknown code |

New codes are six base62 characters, and `hits` starts at zero.

## Clone

Use `--recurse-submodules` to populate all three project folders. A plain clone leaves those folders empty until submodules are initialized.

```sh
git clone --recurse-submodules https://github.com/kenken64/aisdlc-workshop_day1.git
cd aisdlc-workshop_day1
```

## Run

Start the backend first; the frontend and CLI both use it.

```sh
# Terminal 1: API at http://localhost:3000
cd backend && bun start

# Terminal 2: web app at http://localhost:4200
cd frontend && npm install && npx ng serve

# Terminal 3: CLI
cd cli && node cli.js add https://example.com
node cli.js ls
node cli.js open <code>
```

Set `SNIP_API` to point the CLI at a different backend URL.

## Update a project

Commit and push changes from inside the project submodule, then advance its pinned commit from the `main` checkout:

```sh
cd backend
# edit files
git add -A && git commit -m "Update backend" && git push
cd ..
git submodule update --remote backend
git add backend
git commit -m "Bump backend submodule"
git push
```

Repeat with `frontend` or `cli` as needed. The project commit and the superproject pointer update are separate commits.