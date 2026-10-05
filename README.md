# ~/matt

The source of [matthewbracke.com](https://matthewbracke.com).

- `content/` is the folder: everything published lives here as markdown, and it's the only thing the site (and later `/ask`) reads.
- `src/` renders it with Astro; `server.ts` (Hono) serves it.

```sh
pnpm install && pnpm dev     # local
pnpm build && pnpm start     # production, on :3000
```
