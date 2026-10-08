// One function per kind of page. Each builds the preview, then wraps it in the layout.
import { html, raw } from 'hono/html';
import { findImage, imageUrl, resolveLinks, toHtml, toInlineHtml, type Doc, type Site } from '../content.ts';
import { layout, type Req } from './layout.ts';
import { person } from './machines.ts';
import { ago, aside, baseName, fileName, inDir } from './ls.ts';
import { describe, docMarkdown } from './text.ts';

const BLURB: Record<string, string> = {
  made: "Things I've made. Experiments count.",
  notes: 'Writing. Raw over polished.',
  ideas: "Ideas I haven't built. Build one with me, or steal it.",
  crew: 'The agents I work with.',
};

const list = (docs: Doc[], withSummary = false) =>
  html`<ul class="list">${docs.map(
    (d) =>
      html`<li><a href="/${d.path}">${d.title}</a><span>${aside(d)}</span>${withSummary ? html`<small>${describe(d.body)}</small>` : ''}</li>`,
  )}</ul>`;

/** The files either side of this one in its folder: ← prev · made/ 3 of 6 · next → */
function neighbours(doc: Doc, site: Site) {
  const docs = inDir(site.docs, doc.dir);
  if (docs.length < 2) return '';
  const i = docs.indexOf(doc);
  const link = (d: Doc | undefined, label: (name: string) => string) =>
    d ? html`<a href="/${d.path}">${label(baseName(d))}</a>` : '';
  return html`<nav class="term sibs" aria-label="More in ${doc.dir}/"><span class="p">$</span> ls ${doc.dir}/<div><a href="/${doc.dir}">${doc.dir}/ · ${i + 1} of ${docs.length}</a>${link(docs[i - 1], (n) => `← ${n}`)}${link(docs[i + 1], (n) => `${n} →`)}</div></nav>`;
}

export function filePage(doc: Doc, site: Site, req: Req) {
  return layout(
    {
      path: doc.path,
      kind: 'file',
      cmd: `cat ${baseName(doc)}`,
      file: fileName(doc),
      title: `${doc.title} · Matt Bracke`,
      description: describe(doc.body) || doc.title,
      body: toHtml(docMarkdown(doc, site)) + (doc.dir ? neighbours(doc, site) : ''),
      modified: doc.modified,
    },
    site,
    req,
  );
}

export function dirPage(dir: string, site: Site, req: Req) {
  const body = html`<h1>${dir}/</h1>${BLURB[dir] ? html`<p class="blurb">${BLURB[dir]}</p>` : ''}${list(inDir(site.docs, dir), dir !== 'notes')}`;
  const title = `${dir}/ · Matt Bracke`;
  return layout(
    {
      path: dir,
      kind: 'dir',
      cmd: 'ls',
      file: `${dir}/`,
      title,
      description: BLURB[dir] ?? title,
      body: String(body),
    },
    site,
    req,
  );
}

export function missingPage(path: string, site: Site, req: Req) {
  const body = html`<pre class="term"><span class="p">$</span> cat ${path}
cat: ${path}: No such file or directory</pre>
<p>You've drifted off the sheet. You are here → <a href="/">cd&nbsp;~</a></p>`;
  return layout(
    {
      path,
      kind: 'missing',
      cmd: `cat ${path}`,
      file: path,
      title: 'Not found · Matt Bracke',
      description: 'Not found',
      body: String(body),
    },
    site,
    req,
  );
}

// ---- home: README.md's intro next to its photo, then everything else at a glance ----

/** The markdown before the first ## heading (the intro), and the rest. */
function splitIntro(markdown: string) {
  const i = markdown.search(/^## /m);
  return i < 0 ? [markdown, ''] : [markdown.slice(0, i), markdown.slice(i)];
}

/** The first three bullets of now.md: the post-it rule. */
const nowItems = (now: Doc) =>
  now.body
    .split('\n')
    .flatMap((l) => l.match(/^\s*[-*]\s+(.+)$/)?.[1]?.trim() ?? [])
    .slice(0, 3);

function section(dir: string, items: Doc[], total: number, label = 'latest') {
  if (!items.length) return '';
  const more =
    total > items.length ? html`<a class="more" href="/${dir}">ls ${dir}/ → ${total - items.length} more</a>` : '';
  return html`<h2>${dir}/<span class="aside">${label}</span></h2>${list(items)}${more}`;
}

export function homePage(readme: Doc, site: Site, req: Req) {
  const find = (path: string) => site.docs.find((d) => d.path === path);
  const now = find('now');
  const hello = find('hello');
  const photo = readme.data.photo ? findImage(String(readme.data.photo), site.images) : undefined;
  const caption = String(readme.data.caption ?? '');
  const [intro, rest] = splitIntro(resolveLinks(readme, site));
  const made = inDir(site.docs, 'made');
  const notes = inDir(site.docs, 'notes');
  const ideas = inDir(site.docs, 'ideas').filter((d) => (d.data.status ?? 'open') === 'open');
  const items = now ? nowItems(now) : [];
  // a tiny lens on the face, next to the name; hover or tap opens the whole photo.
  // `focus: 45% 17%` in the frontmatter says where the face is.
  const focus = String(readme.data.focus ?? '').match(/^([\d.]+%) ([\d.]+%)$/);
  const figure = photo
    ? html`<figure class="photo" tabindex="0"${focus ? raw(` style="--x: ${focus[1]}; --y: ${focus[2]}"`) : ''}><span class="lens"><img src="${imageUrl(photo)}" alt="${caption}"><figcaption>${caption}</figcaption></span></figure>`
    : '';
  const introHtml = toHtml(intro)
    .replace('<p>', '<p class="lede">')
    .replace(/<h1>[^]*?<\/h1>/, (h1) => `<div class="who">${h1}${figure}</div>`);

  const body = html`
<div class="intro">${raw(introHtml)}</div>
${now && items.length ? html`<h2>now<span class="aside">updated ${now.date ?? ago(now.modified)}</span></h2><div class="now">${items.map((t, i) => html`<div><b>0${i + 1}</b>${raw(toInlineHtml(t))}</div>`)}</div>` : ''}
${section('made', made.slice(0, 4), made.length)}
${section('notes', notes.slice(0, 3), notes.length)}
${section('ideas', ideas.slice(0, 3), ideas.length, 'open · build one with me, or steal it')}
${
  now
    ? html`<h2>for machines</h2><pre class="term"><span class="p">$</span> curl ${req.host}/now

${docMarkdown(now, site).trim()}

<span class="src">↳ every page is plain markdown for terminals and agents: add .md to any url
↳ for agents: <a href="/llms.txt">llms.txt</a> · <a href="/llms-full.txt">llms-full.txt</a> · <a href="/rss.xml">rss.xml</a></span></pre>`
    : ''
}
${raw(toHtml(rest))}
${hello ? html`<h2>hello.txt</h2><div class="door">${raw(toHtml(resolveLinks(hello, site).replace(/^#\s.*\n+/, '')))}</div>` : ''}`;

  return layout(
    {
      path: '',
      kind: 'home',
      cmd: 'cat README.md',
      file: 'README.md',
      title: 'Matt Bracke',
      description: describe(intro),
      body: String(body),
      modified: readme.modified,
      image: photo && imageUrl(photo),
      jsonLd: person(readme, site, req.origin),
    },
    site,
    req,
  );
}
