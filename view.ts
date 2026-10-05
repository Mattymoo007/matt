import { html, raw } from 'hono/html';
import type { Doc } from './content.ts';

const SECTIONS = ['made', 'notes', 'ideas', 'crew'];
const OPEN = new Set(['ideas']); // drwxrwxrwx: open to everyone
const ORDER = ['', 'now', ...SECTIONS, 'hello'];
const META: Record<string, string> = { '': 'who I am', hello: 'say hi' };
const rank = (path: string) => (ORDER.includes(path) ? ORDER.indexOf(path) : ORDER.length);

function ago(d: Date) {
  const s = (Date.now() - +d) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.round(s / 86400)}d ago`;
  return d.toISOString().slice(0, 10);
}

/** The ls pane: top-level files, then the folders that have something in them. */
function listing(docs: Doc[]) {
  const files = docs.filter((d) => !d.dir).map((d) => ({ path: d.path, href: `/${d.path}`, perm: '-rw-r--r--', name: `${d.path || 'README'}.md`, meta: META[d.path] ?? `edited ${ago(d.modified)}`, dir: false }));
  const dirs = SECTIONS.map((name) => ({ name, docs: docs.filter((d) => d.dir === name) }))
    .filter((s) => s.docs.length)
    .map((s) => ({ path: s.name, href: `/${s.name}`, perm: OPEN.has(s.name) ? 'drwxrwxrwx' : 'drwxr-xr-x', name: s.name, meta: `${s.docs.length} · ${ago(s.docs[0].modified)}`, dir: true }));
  return [...files, ...dirs].sort((a, b) => rank(a.path) - rank(b.path) || a.name.localeCompare(b.name));
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

type Page = { docs: Doc[]; active: string; cmd: string; file: string; modified?: Date; body: string };

export function page({ docs, active, cmd, file, modified, body }: Page) {
  const newest = docs.reduce<Date | undefined>((n, d) => (!n || d.modified > n ? d.modified : n), undefined);
  return html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${file === 'README.md' ? 'Matt Bracke' : `${file} · Matt Bracke`}</title>
<style>${raw(CSS)}</style>
</head>
<body>
  <header class="bar"><span>matt@earth:<b>~/matt</b> $ ${cmd}<span class="cursor"></span></span></header>
  <main>
    <nav class="ls">
      <div class="cmd">total ${docs.length}${newest ? ` · last write ${ago(newest)}` : ''}</div>
      ${listing(docs).map((r) => html`<a class="row${r.dir ? ' dir' : ''}${r.href === `/${active}` ? ' active' : ''}" href="${r.href}"><span class="perm">${r.perm}</span><span class="name">${r.name}</span><span class="meta">${r.meta}</span></a>`)}
    </nav>
    <article class="preview">
      <div class="file"><span>~/matt/${file}</span><span>${modified ? `modified ${modified.toISOString().slice(0, 10)}` : ''}</span></div>
      ${raw(body)}
    </article>
  </main>
  <footer class="status"><span class="mode">NORMAL</span><span>${file}</span><span class="grow"></span><span>Gent · Earth</span><span>utf-8</span></footer>
</body>
</html>`;
}

export function dirBody(docs: Doc[], dir: string) {
  return String(html`<h1>${dir}/</h1><ul class="list">${docs
    .filter((d) => d.dir === dir)
    .map((d) => html`<li><a href="/${d.path}">${d.title}</a><span>${dir === 'made' ? `${d.data.year ?? ''} · ${d.data.material ?? ''}` : dir === 'ideas' ? String(d.data.status ?? 'open') : (d.date ?? ago(d.modified))}</span></li>`)}</ul>`);
}

const CSS = `
:root { --bg: #f7f6f2; --ink: #111; --mute: #888; --line: #1111221f; --sel: #dfe6f0; --accent: #2f5d9b; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: var(--bg); color: var(--ink); font: 13px/1.6 "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace; min-height: 100vh; display: flex; flex-direction: column; }
a { color: inherit; }
.bar { padding: 14px 24px; border-bottom: 1px solid var(--ink); overflow-wrap: anywhere; }
.cursor { display: inline-block; width: 8px; height: 15px; background: var(--ink); vertical-align: -2px; animation: blink 1s steps(1) infinite; margin-left: 4px; }
@keyframes blink { 50% { opacity: 0; } }
main { flex: 1; display: grid; grid-template-columns: 400px 1fr; }
.ls { border-right: 1px solid var(--ink); padding: 18px 0; }
.ls .cmd { padding: 0 24px 12px; color: var(--mute); }
.row { display: grid; grid-template-columns: 92px 1fr auto; gap: 12px; padding: 7px 24px; text-decoration: none; }
.row .perm, .row .meta { color: var(--mute); }
.row .meta { font-size: 11px; }
.row.dir .name::after { content: "/"; color: var(--accent); }
.row.active { background: var(--sel); }
.row:hover { background: #1111110a; }
.preview { padding: 48px 64px; font: 17px/1.6 "Inter Tight", system-ui, sans-serif; max-width: 860px; }
.preview .file { font: 11px "JetBrains Mono", ui-monospace, monospace; color: var(--mute); margin-bottom: 28px; display: flex; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--line); padding-bottom: 10px; }
.preview h1 { font-weight: 500; font-size: 48px; letter-spacing: -.035em; line-height: 1.05; margin-bottom: 20px; }
.preview h1::before { content: "# "; color: #bbb; font-weight: 400; }
.preview h2 { font: 500 12px "JetBrains Mono", ui-monospace, monospace; margin: 32px 0 10px; }
.preview h2::before { content: "## "; color: #bbb; }
.preview p, .preview ul, .preview ol, .preview blockquote { margin-bottom: 14px; max-width: 640px; }
.preview ul, .preview ol { padding-left: 20px; }
.preview blockquote { border-left: 2px solid var(--accent); padding-left: 14px; color: #444; }
.preview code { font: 14px "JetBrains Mono", ui-monospace, monospace; background: var(--sel); padding: 1px 5px; }
.preview pre { background: #111; color: #e8e6df; padding: 16px 18px; overflow-x: auto; margin-bottom: 14px; }
.preview pre code { background: none; padding: 0; }
.preview img { max-width: 100%; margin: 8px 0; filter: grayscale(1) contrast(1.1); }
.preview table { border-collapse: collapse; margin-bottom: 18px; font: 12px/1.5 "JetBrains Mono", ui-monospace, monospace; }
.preview th, .preview td { border: 1px solid var(--ink); padding: 6px 12px; text-align: left; vertical-align: top; }
.preview th { font-weight: 500; color: var(--mute); text-transform: uppercase; letter-spacing: .06em; font-size: 10px; }
.preview th:empty { display: none; }
.preview thead:has(th:empty) { display: none; }
.preview .list { list-style: none; padding: 0; }
.preview .list li { padding: 8px 0; border-bottom: 1px dashed var(--line); display: grid; grid-template-columns: 1fr auto; gap: 12px; }
.preview .list li a { text-decoration: none; }
.preview .list li a:hover { text-decoration: underline; }
.preview .list li span { font: 11px "JetBrains Mono", ui-monospace, monospace; color: var(--mute); }
.status { display: flex; border-top: 1px solid var(--ink); font-size: 11px; position: sticky; bottom: 0; background: var(--bg); }
.status span { padding: 5px 14px; border-right: 1px solid var(--line); }
.status .mode { background: var(--ink); color: var(--bg); font-weight: 700; }
.status .grow { flex: 1; border: 0; }
@media (max-width: 760px) {
  main { grid-template-columns: 1fr; align-content: start; }
  .ls { border-right: 0; border-bottom: 1px solid var(--ink); padding: 12px 0; }
  .row { grid-template-columns: 1fr auto; padding: 7px 16px; }
  .row .perm { display: none; }
  .ls .cmd, .bar { padding-left: 16px; padding-right: 16px; }
  .preview { padding: 28px 16px; }
  .preview h1 { font-size: 36px; }
  .status span:nth-child(n+4) { display: none; }
}
`;
