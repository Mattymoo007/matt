# ~/matt

The source of [matthewbracke.com](https://matthewbracke.com): a tiny [Hono](https://hono.dev) server that renders a folder of markdown.

- **The folder** is the `Public/` folder of my Obsidian vault, mirrored to the server and mounted read-only. Only notes with `publish: true` are ever served; everything else doesn't exist as far as the site knows.
- **No build, no redeploy for content.** Write in Obsidian, flip `publish`, it's live.
- **Every page is also markdown**: `curl matthewbracke.com`, or add `.md` to any URL.

```
src/
  content.ts        the folder: scan, publish gate, [[wikilinks]], images
  server.ts         routes
  views/
    ls.ts           the file listing (shared by HTML and text)
    text.ts         markdown for curl and agents
    layout.ts       the ~/matt shell around every page
    pages.ts        home, file, folder, 404
assets/             site.css, site.js (the prompt, j/k keys, the Gent clock), fonts
test/gate.test.ts   the publish gate: nothing private gets out
```

```sh
pnpm install
CONTENT_DIR=~/path/to/Public pnpm dev   # http://localhost:3000
pnpm check && pnpm test                 # also run on every deploy
```

No framework, no build step: Node 24 runs the TypeScript directly. Page changes use the browser's View Transitions and hovered links are prefetched, so it feels like an app without being one.

Fonts: [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono) and [Inter Tight](https://github.com/rsms/inter), SIL Open Font License 1.1 (see `assets/fonts/`).
