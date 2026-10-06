// The ~/matt shell around every page: prompt bar, file list, preview, status bar.
import { html, raw } from 'hono/html';
import type { Site } from '../content.ts';
import { ago, baseName, inDir, listing, MACHINES, SECTIONS } from './ls.ts';

export const VERSION = Date.now().toString(36); // busts the asset cache on every deploy

export type Page = {
  path: string;
  kind: 'home' | 'file' | 'dir' | 'missing';
  cmd: string; // what the prompt shows, e.g. `cat now.md`
  file: string;
  title: string;
  description: string;
  body: string; // the preview's HTML
  modified?: Date;
  image?: string;
  jsonLd?: object; // structured data for search engines and agents
};

/** Where the request came from, for absolute urls and the curl example. */
export type Req = { host: string; origin: string };

const FAVICON = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#111"/><rect x="38" y="16" width="12" height="32" fill="#2f5d9b"/><path d="M12 40c4-8 8-8 12-4s8 4 12-4" stroke="#f7f6f2" stroke-width="5" fill="none" stroke-linecap="round"/></svg>',
)}`;

// Prefetch a page when a link is hovered, so moving around feels instant. Raw files (.md, .txt, .xml) are skipped.
const SPECULATION = JSON.stringify({
  prefetch: [
    {
      where: { and: [{ href_matches: '/*' }, { not: { href_matches: ['/*.md', '/*.txt', '/*.xml'] } }] },
      eagerness: 'moderate',
    },
  ],
});

/** JSON that's safe inside a <script>. */
const json = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c');

/** A path with every folder on the way as a link: ~/matt/made/stickit.md */
function crumbs(path: string) {
  const parts = path.split('/');
  const last = parts.pop();
  return html`<span class="crumbs"><a href="/">~/matt</a>${parts.map((d, i) => html`/<a href="/${parts.slice(0, i + 1).join('/')}">${d}</a>`)}${last ? `/${last}` : ''}</span>`;
}

// Runs before the first paint so a saved theme never flashes: the visitor's choice, else their system's light or dark.
const THEME = `{let t;try{t=localStorage.theme}catch{}document.documentElement.dataset.theme=t||(matchMedia('(prefers-color-scheme: dark)').matches?'night':'day')}`;

export function layout(p: Page, site: Site, req: Req) {
  const newest = site.docs.reduce<Date | undefined>((n, d) => (!n || d.modified > n ? d.modified : n), undefined);
  const url = `${req.origin}/${p.path}`;
  const parent = p.path.includes('/') ? p.path.split('/')[0] : '';
  const cwd = p.kind === 'dir' ? p.path : parent;
  const hasRaw = p.kind === 'file' || p.kind === 'home';
  const rawHref = p.path ? `/${p.path}.md` : '/README.md';
  // what the prompt can open and search: every doc and folder
  const index = [
    ...site.docs.map((d) => ({ p: d.path, t: d.title, d: d.dir })),
    ...SECTIONS.filter((s) => site.docs.some((d) => d.dir === s)).map((s) => ({ p: s, t: `${s}/`, d: s })),
  ];
  // the folder you're in unfolds, like `tree`
  const tree = (dir: string) => {
    const docs = inDir(site.docs, dir);
    return docs.map(
      (d, i) =>
        html`<a class="row leaf${d.path === p.path ? ' active' : ''}" href="/${d.path}"><span class="perm"></span><span class="name"><i>${i === docs.length - 1 ? '└──' : '├──'}</i>${baseName(d)}</span><span class="meta">${d.date ?? ''}</span></a>`,
    );
  };

  return html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${p.title}</title>
<meta name="description" content="${p.description}">
<meta property="og:title" content="${p.title}">
<meta property="og:description" content="${p.description}">
<meta property="og:url" content="${url}">
<meta property="og:type" content="${p.kind === 'file' ? 'article' : 'website'}">
${p.image ? html`<meta property="og:image" content="${req.origin}${p.image}"><meta name="twitter:card" content="summary_large_image">` : ''}
<meta name="theme-color" content="#f7f6f2">
<script>${raw(THEME)}</script>
<link rel="icon" href="${FAVICON}">
${hasRaw ? html`<link rel="alternate" type="text/markdown" href="${rawHref}">` : ''}
<link rel="alternate" type="application/rss+xml" title="Matt Bracke" href="/rss.xml">
${p.jsonLd ? html`<script type="application/ld+json">${raw(json(p.jsonLd))}</script>` : ''}
<link rel="preload" href="/assets/fonts/jetbrains-mono.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/inter-tight.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/site.css?v=${VERSION}">
<script src="/assets/site.js?v=${VERSION}" defer></script>
<script type="speculationrules">${raw(SPECULATION)}</script>
</head>
<body class="page-${p.kind}" data-path="${p.path}">
  <form class="bar" role="search" autocomplete="off">
    <label for="prompt">matt@earth:<b>${crumbs(cwd ? `${cwd}/` : '')}</b> $</label>
    <span class="field"><input id="prompt" name="q" placeholder=" " spellcheck="false" autocapitalize="off" aria-label="Type a command, or search"><span class="ghost" aria-hidden="true">${p.cmd}<span class="cursor"></span></span></span>
    <span class="hint">type a command · <b>?</b> help</span>
    <div class="out" hidden aria-live="polite"></div>
  </form>
  <main>
    <nav class="ls" aria-label="Files"><div class="ls-inner">
      <div class="cmd">total ${site.docs.length}${newest ? ` · last write ${ago(newest)}` : ''}</div>
      ${listing(site.docs).map(
        (r) =>
          html`<a class="row${r.dir ? ' dir' : ''}${r.path === p.path ? ' active' : ''}" href="/${r.path}"><span class="perm">${r.perm}</span><span class="name">${r.name}</span><span class="meta">${r.meta}</span></a>${r.dir && r.path === cwd ? tree(r.path) : ''}`,
      )}
      <div class="group">for machines</div>
      ${MACHINES.map(
        (m) =>
          html`<a class="row" href="/${m.path}"><span class="perm">-r--r--r--</span><span class="name">${m.path}</span><span class="meta">${m.meta}</span></a>`,
      )}
    </div></nav>
    <article class="preview">
      ${p.kind === 'home' ? '' : html`<a class="up" href="/${parent}">cd ..</a>`}
      <div class="file">${crumbs(p.file)}<span class="grow"></span>${p.modified ? html`<span>modified ${p.modified.toISOString().slice(0, 10)}</span>` : ''}${hasRaw ? html`<a href="${rawHref}" title="This page as markdown">raw</a>` : ''}</div>
      ${raw(p.body)}
    </article>
  </main>
  <footer class="status"><button class="theme" type="button" title="Switch theme: day, night, synthwave '84"></button><span>${p.file}</span><span class="grow"></span><span class="clock">Gent · Earth</span><span>utf-8</span><span>j/k · ? help</span></footer>
  <dialog id="help" aria-label="Keys and commands">
    <form method="dialog">
      <dl>
        <dt>ls [dir]</dt><dd>list a folder</dd>
        <dt>cd &lt;dir&gt;</dt><dd>open a folder · cd .. · cd ~</dd>
        <dt>cat &lt;file&gt;</dt><dd>open a file</dd>
        <dt>anything else</dt><dd>search</dd>
        <dt>j / k</dt><dd>move through the files · ↵ opens</dd>
        <dt>- / h</dt><dd>up a folder</dd>
        <dt>/</dt><dd>focus the prompt (or just start typing)</dd>
        <dt>esc</dt><dd>close the prompt</dd>
        <dt>theme [name]</dt><dd>day · night · synthwave · or click the bottom-left corner</dd>
      </dl>
      <p>Every page is also markdown: add .md to the url, or curl it.<br>esc closes this.</p>
    </form>
  </dialog>
  <script type="application/json" id="idx">${raw(json(index))}</script>
</body>
</html>`;
}
