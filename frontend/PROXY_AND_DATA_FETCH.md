# Frontend → Backend data fetch (read this before changing env or rewrites)

This doc explains how the Next.js frontend talks to the FastAPI backend in
local Docker development, and the three gotchas that bit us. Read it before
touching `NEXT_PUBLIC_API_BASE_URL`, `next.config.js`, or `lib/api.ts`.

## TL;DR

- The frontend runs in a Docker container; the backend runs in another.
- The browser runs on the host (macOS), not in a container.
- A single `NEXT_PUBLIC_API_BASE_URL` cannot be correct for both the
  server-side fetch (inside the container) and the client-side fetch
  (in the browser), because the names `localhost` and
  `host.docker.internal` resolve differently in each context.
- We solve this with a Next.js **rewrite**: every `/api/*` request is
  proxied by the Next server to the backend. The frontend always uses
  same-origin URLs; only the Next server ever talks to the backend
  directly.

## Layout

```
Browser (macOS)  ──HTTP──▶  Next container (3000)  ──HTTP──▶  Backend container (8000)
                    /api/...                        /api/... (via host.docker.internal)
                       │                                  │
                       └── via rewrite in next.config.js ┘
```

## The three contexts, and the right URL for each

| Where the fetch runs | What `localhost` means | What `host.docker.internal` means |
|---|---|---|
| Browser on macOS | The host machine (your laptop) | **Unresolvable** — DNS name only exists inside Docker |
| Next container | The container's own loopback (nothing listening) | The host machine (the backend is reachable this way) |
| Host shell | The host machine | The host machine |

This is why the original `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`
worked from the host but broke everywhere else, and why
`http://host.docker.internal:8000` worked from inside the containers but
broke in the browser.

## How the rewrite fixes it

`next.config.js`:

```js
async rewrites() {
  return [{
    source: "/api/:path*",
    destination: `${process.env.API_PROXY_TARGET || "http://host.docker.internal:8000"}/api/:path*`,
  }];
}
```

This means: any request that hits the Next server at `/api/...` is
forwarded to `http://host.docker.internal:8000/api/...` on the backend.
The frontend code never needs to know the backend's address.

## How `lib/api.ts` builds URLs

`NEXT_PUBLIC_API_BASE_URL` in `.env.local` is **empty**. The URL builder
handles both contexts:

```ts
const isServer = typeof window === "undefined";
const origin = isServer ? `http://localhost:${process.env.PORT || 3000}` : "";
const url = BASE ? `${BASE}${relPath}` : `${origin}${relPath}`;
```

- **Server-side** (`isServer === true`, e.g. SSR `fetch` inside a server
  component): builds `http://localhost:3000/api/...`. Node's `fetch`
  refuses relative URLs, so we have to give it an absolute URL. Pointing
  at our own Next origin keeps the request same-origin and the rewrite
  forwards it to the backend.
- **Browser-side** (`isServer === false`): builds the relative
  `/api/...`. The browser navigates to the Next server, which applies
  the rewrite.

In both cases, the request path is identical: same-origin → rewrite →
backend.

## Gotcha: cached compilation

`NEXT_PUBLIC_*` env vars are **inlined at compile time** by Next.js.
`.env.local` on disk does not affect a running container until the
container is recreated (not just restarted) so the `.next` build cache
gets cleared. If you change `NEXT_PUBLIC_API_BASE_URL` or any
`NEXT_PUBLIC_*` var and don't see the change, recreate the container:

```bash
docker stop incident-stories-frontend-dev
docker rm -f incident-stories-frontend-dev
docker volume rm rohit_interview_stories_frontend-next-cache   # if it exists
# ... then run your docker run command again ...
```

## Gotcha: relative URLs in Node

Node 20's built-in `fetch` refuses relative URLs and throws
`TypeError: Failed to parse URL`. The browser's `fetch` is happy with
them. This is why the URL builder in `lib/api.ts` constructs an
absolute `http://localhost:3000/...` on the server but a relative
`/api/...` in the browser.

## Gotcha: CORS

With the rewrite, the browser never makes a cross-origin request —
every request is same-origin against the Next server. CORS never
becomes an issue for `/api/*`. `ALLOWED_ORIGINS` in the backend `.env`
is still required for any non-rewrite caller (e.g. direct curl from
the host, or external scripts hitting `http://localhost:8000`
directly).

## Verifying it works

Run these from the host shell:

```bash
# Same-origin rewrite (the path the browser uses):
curl -i http://localhost:3000/api/incidents?page=1

# Direct backend (only for sanity-checking the backend itself):
curl -i http://localhost:8000/api/incidents?page=1

# Both should return 200 with the same JSON body.
```

## What NOT to do

- **Do not** set `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000` — that
  only works from the host browser, and it will break the SSR fetch
  inside the container.
- **Do not** set `NEXT_PUBLIC_API_BASE_URL=http://host.docker.internal:8000`
  — that works inside the container but the browser can't resolve
  `host.docker.internal`.
- **Do not** add `NEXT_PUBLIC_*` env vars via `docker run -e`. They
  *can* be passed that way, but they're inlined at compile time and
  the `.env.local` file is the source of truth. Pick one.
- **Do not** bypass the rewrite by hard-coding an absolute URL into
  `api.ts`. The whole point is that the frontend doesn't need to
  know the backend's address.