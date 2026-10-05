import { html, raw } from 'hono/html';
import { toHtml, toInlineHtml, type Doc } from './content.ts';

export const VERSION = Date.now().toString(36); // busts the asset cache on every deploy

const SECTIONS = ['made', 'notes', 'ideas', 'crew'];
const OPEN = new Set(['ideas']); // drwxrwxrwx: open to everyone
const ORDER = ['', 'now', ...SECTIONS, 'hello'];
const META: Record<string, string> = { '': 'who I am', hello: 'say hi' };
const BLURB: Record<string, string> = {
  made: "Things I've made. Experiments count.",
  notes: 'Writing. Raw over polished.',
  ideas: "Ideas I haven't built. Build one with me, or steal it.",
  crew: 'The agents I work with.',
};
const rank = (path: string) => (ORDER.includes(path) ? ORDER.indexOf(path) : ORDER.length);
export const fileName = (d: Doc) => `${d.path || 'README'}.md`;

function ago(d: Date) {
  const s = (Date.now() - +d) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.round(s / 86400)}d ago`;
  return d.toISOString().slice(0, 10);
}

/** The ls pane: top-level files and the folders that have something in them, in mockup order. */
function listing(docs: Doc[]) {
  const files = docs.filter((d) => !d.dir).map((d) => ({ path: d.path, perm: '-rw-r--r--', name: fileName(d), meta: META[d.path] ?? `edited ${ago(d.modified)}`, dir: false }));
  const dirs = SECTIONS.map((name) => ({ name, docs: docs.filter((d) => d.dir === name) }))
    .filter((s) => s.docs.length)
    .map((s) => ({ path: s.name, perm: OPEN.has(s.name) ? 'drwxrwxrwx' : 'drwxr-xr-x', name: s.name, meta: `${s.docs.length} · ${ago(s.docs[0].modified)}`, dir: true }));
  return [...files, ...dirs].sort((a, b) => rank(a.path) - rank(b.path) || a.name.localeCompare(b.name));
}

const aside = (d: Doc) =>
  d.dir === 'made' ? [d.data.year, d.data.material].filter(Boolean).join(' · ') : d.dir === 'ideas' ? String(d.data.status ?? 'open') : (d.date ?? ago(d.modified));

/** A short plain-text description for link previews. */
export function describe(markdown: string) {
  const line = markdown.split('\n').map((l) => l.trim()).find((l) => l && !/^(#|[-*|>!]|```)/.test(l)) ?? '';
  const text = line.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`]/g, '');
  return text.length > 160 ? text.slice(0, 157) + '…' : text;
}

// ---- plain text, for curl and agents ----

export function textLs(docs: Doc[], dir = '') {
  if (!dir) return listing(docs).map((r) => `${r.perm}  ${r.name}${r.dir ? '/' : ''}`.padEnd(32) + r.meta).join('\n');
  return docs.filter((d) => d.dir === dir).map((d) => `${(d.date ?? '').padEnd(12)}${d.path}.md  ${d.title}`).join('\n');
}

const SPECS: Record<string, string[]> = { made: ['qty', 'material', 'year', 'status'], ideas: ['status', 'date'] };

/** The doc as markdown: a title if the body has none, and (for made/ideas) a one-row parts list. */
export function textDoc(doc: Doc, markdown: string) {
  const head = /^#\s/.test(markdown.trimStart()) ? '' : `# ${doc.title}\n\n`;
  const keys = (SPECS[doc.dir] ?? []).filter((k) => doc.data[k] != null && doc.data[k] !== '');
  const specs = keys.length ? `| ${keys.join(' | ')} |\n|${' --- |'.repeat(keys.length)}\n| ${keys.map((k) => String(doc.data[k])).join(' | ')} |\n\n` : '';
  return head + specs + markdown.trim() + '\n';
}

// ---- HTML ----

type Page = {
  docs: Doc[];
  path: string;
  kind: 'home' | 'file' | 'dir' | 'missing';
  cmd: string;
  file: string;
  modified?: Date;
  body: string;
  title: string;
  description: string;
  image?: string;
  origin: string;
};

const FAVICON = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#111"/><rect x="38" y="16" width="12" height="32" fill="#2f5d9b"/><path d="M12 40c4-8 8-8 12-4s8 4 12-4" stroke="#f7f6f2" stroke-width="5" fill="none" stroke-linecap="round"/></svg>')}`;

export function page(p: Page) {
  const newest = p.docs.reduce<Date | undefined>((n, d) => (!n || d.modified > n ? d.modified : n), undefined);
  const idx = [
    ...p.docs.map((d) => ({ p: d.path, t: d.title, d: d.dir })),
    ...SECTIONS.filter((s) => p.docs.some((d) => d.dir === s)).map((s) => ({ p: s, t: `${s}/`, d: s })),
  ];
  const url = p.origin + (p.path ? `/${p.path}` : '/');
  const parent = p.path.includes('/') ? p.path.split('/')[0] : '';
  const rawHref = p.path ? `/${p.path}.md` : '/README.md';
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
${p.image ? html`<meta property="og:image" content="${p.origin}${p.image}"><meta name="twitter:card" content="summary_large_image">` : ''}
<meta name="theme-color" content="#f7f6f2">
<link rel="icon" href="${FAVICON}">
${p.kind === 'file' || p.kind === 'home' ? html`<link rel="alternate" type="text/markdown" href="${rawHref}">` : ''}
<link rel="preload" href="/assets/fonts/jetbrains-mono.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/inter-tight.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/site.css?v=${VERSION}">
<script src="/assets/site.js?v=${VERSION}" defer></script>
</head>
<body class="page-${p.kind}" data-path="${p.path}">
  <form class="bar" role="search" autocomplete="off">
    <label for="prompt">matt@earth:<b>~/matt</b> $</label>
    <span class="field"><input id="prompt" name="q" placeholder=" " spellcheck="false" autocapitalize="off" aria-label="Type a command, or search"><span class="ghost" aria-hidden="true">${p.cmd}<span class="cursor"></span></span></span>
    <span class="hint">type a command · <b>?</b> help</span>
    <div class="out" hidden aria-live="polite"></div>
  </form>
  <main>
    <nav class="ls" aria-label="Files"><div class="ls-inner">
      <div class="cmd">total ${p.docs.length}${newest ? ` · last write ${ago(newest)}` : ''}</div>
      ${listing(p.docs).map((r) => html`<a class="row${r.dir ? ' dir' : ''}${r.path === p.path || (r.dir && p.path.startsWith(`${r.path}/`)) ? ' active' : ''}" href="/${r.path}"><span class="perm">${r.perm}</span><span class="name">${r.name}</span><span class="meta">${r.meta}</span></a>`)}
    </div></nav>
    <article class="preview">
      ${p.kind === 'home' ? '' : html`<a class="up" href="/${parent}">cd ..</a>`}
      <div class="file"><span>~/matt/${p.file}</span><span class="grow"></span>${p.modified ? html`<span>modified ${p.modified.toISOString().slice(0, 10)}</span>` : ''}${p.kind === 'file' || p.kind === 'home' ? html`<a href="${rawHref}" title="This page as markdown">raw</a>` : ''}</div>
      ${raw(p.body)}
    </article>
  </main>
  <footer class="status"><span class="mode">NORMAL</span><span>${p.file}</span><span class="grow"></span><span class="clock">Gent · Earth</span><span>utf-8</span><span>j/k · ? help</span></footer>
  <dialog id="help" aria-label="Keys and commands">
    <form method="dialog">
      <dl>
        <dt>ls [dir]</dt><dd>list a folder</dd>
        <dt>cd &lt;dir&gt;</dt><dd>open a folder · cd .. · cd ~</dd>
        <dt>cat &lt;file&gt;</dt><dd>open a file</dd>
        <dt>anything else</dt><dd>search</dd>
        <dt>j / k</dt><dd>move through the files · ↵ opens</dd>
        <dt>/</dt><dd>focus the prompt (or just start typing)</dd>
        <dt>esc</dt><dd>back to NORMAL</dd>
      </dl>
      <p>Every page is also markdown: add .md to the url, or curl it.<br>esc closes this.</p>
    </form>
  </dialog>
  <script type="application/json" id="idx">${raw(JSON.stringify(idx).replace(/</g, '\\u003c'))}</script>
</body>
</html>`;
}

const list = (docs: Doc[], small = false) =>
  html`<ul class="list">${docs.map((d) => html`<li><a href="/${d.path}">${d.title}</a><span>${aside(d)}</span>${small ? html`<small>${describe(d.body)}</small>` : ''}</li>`)}</ul>`;

export function dirBody(docs: Doc[], dir: string) {
  const items = docs.filter((d) => d.dir === dir);
  return String(html`<h1>${dir}/</h1>${BLURB[dir] ? html`<p class="blurb">${BLURB[dir]}</p>` : ''}${list(items, dir !== 'notes')}`);
}

export function missingBody(path: string) {
  return String(html`<pre class="term"><span class="p">$</span> cat ${path}
cat: ${path}: No such file or directory</pre>
<p>You've drifted off the sheet. You are here → <a href="/">cd ~</a></p>`);
}

/** The markdown before the first ## heading (the intro), and the rest. */
function splitIntro(markdown: string) {
  const i = markdown.search(/^## /m);
  return i < 0 ? [markdown, ''] : [markdown.slice(0, i), markdown.slice(i)];
}

type Home = {
  docs: Doc[];
  readme: string; // README markdown, links resolved
  photo?: { src: string; caption: string };
  now?: Doc;
  hello?: string; // hello.md markdown, links resolved
  host: string;
  nowText?: string; // what `curl host/now` returns
};

export function homeBody({ docs, readme, photo, now, hello, host, nowText }: Home) {
  const [intro, rest] = splitIntro(readme);
  const introHtml = toHtml(intro).replace('<p>', '<p class="lede">');
  const nowItems = (now?.body ?? '').split('\n').map((l) => l.match(/^\s*[-*]\s+(.+)$/)?.[1]?.trim()).filter(Boolean).slice(0, 3) as string[];
  const recent = (dir: string, n: number) => docs.filter((d) => d.dir === dir).slice(0, n);
  const openIdeas = docs.filter((d) => d.dir === 'ideas' && (d.data.status ?? 'open') === 'open');
  const section = (dir: string, items: Doc[], total: number, label = 'latest') =>
    items.length ? html`<h2>${dir}/<span class="aside">${label}</span></h2>${list(items)}${total > items.length ? html`<a class="more" href="/${dir}">ls ${dir}/ → ${total - items.length} more</a>` : ''}` : '';

  return String(html`
<div class="intro">
  <div>${raw(introHtml)}</div>
  ${photo ? html`<figure class="photo"><img src="${photo.src}" alt="${photo.caption}" width="700" height="760"><figcaption>${photo.caption}</figcaption></figure>` : ''}
</div>
${nowItems.length ? html`<h2>now<span class="aside">updated ${now?.date ?? ago(now!.modified)}</span></h2><div class="now">${nowItems.map((t, i) => html`<div><b>0${i + 1}</b>${raw(toInlineHtml(t))}</div>`)}</div>` : ''}
${section('made', recent('made', 4), docs.filter((d) => d.dir === 'made').length)}
${section('notes', recent('notes', 3), docs.filter((d) => d.dir === 'notes').length)}
${section('ideas', openIdeas.slice(0, 3), openIdeas.length, 'open · build one with me, or steal it')}
${nowText ? html`<h2>for machines</h2><pre class="term"><span class="p">$</span> curl ${host}/now

${nowText.trim()}

<span class="src">↳ every page is plain markdown for terminals and agents: add .md to any url</span></pre>` : ''}
${raw(toHtml(rest))}
${hello ? html`<h2>hello.txt</h2><div class="door">${raw(toHtml(hello.replace(/^#\s.*\n+/, '')))}</div>` : ''}`);
}
