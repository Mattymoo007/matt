# ~/matt

The source of [matthewbracke.com](https://matthewbracke.com): a tiny [Hono](https://hono.dev) server that renders a folder of markdown.

- **The folder** is the `Public/` folder of my Obsidian vault, mirrored to the server and mounted read-only. Only notes with `publish: true` are ever served; everything else doesn't exist as far as the site knows.
- **No build, no redeploy for content.** Write in Obsidian, flip `publish`, it's live.
- **Every page is also markdown**: `curl matthewbracke.com`, or add `.md` to any URL.

```
content.ts   reads the folder, the publish gate, [[wikilinks]] and images
view.ts      the ~/matt shell (HTML) and the plain-text views
server.ts    routes
assets/      site.css, site.js (the prompt, j/k keys, the Gent clock), fonts
```

Fonts: [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono) and [Inter Tight](https://github.com/rsms/inter), SIL Open Font License 1.1 (see `assets/fonts/`).

```sh
pnpm install
CONTENT_DIR=~/path/to/Public pnpm dev   # http://localhost:3000
```
