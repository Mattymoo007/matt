# ~/matt

The source of [matthewbracke.com](https://matthewbracke.com): a tiny [Hono](https://hono.dev) server that renders a folder of markdown.

- **The folder** is the `Public/` folder of my Obsidian vault, mirrored to the server and mounted read-only. Only notes with `publish: true` are ever served; everything else doesn't exist as far as the site knows.
- **No build, no redeploy for content.** Write in Obsidian, flip `publish`, it's live.
- **Every page is also markdown**: `curl matthewbracke.com`, or add `.md` to any URL.

```
content.ts   reads the folder, the publish gate, [[wikilinks]]
view.ts      the ~/matt shell (HTML) and the plain-text views
server.ts    routes
```

```sh
pnpm install
CONTENT_DIR=~/path/to/Public pnpm dev   # http://localhost:3000
```
