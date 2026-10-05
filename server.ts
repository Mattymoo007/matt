import { serve } from '@hono/node-server';
import { Hono, type Context } from 'hono';
import { CONTENT_DIR, load, toHtml, toMarkdown, type Doc } from './content.ts';
import { dirBody, page, textDoc, textLs } from './view.ts';

const app = new Hono();

// Shown until README.md in the folder is published.
const PLACEHOLDER: Doc = {
  path: '', file: 'README.md', dir: '', title: 'Matt Bracke', data: {}, modified: new Date(),
  body: '# Matt Bracke\n\n`~/matt` is being built in public: [github.com/Mattymoo007/matt](https://github.com/Mattymoo007/matt).\n',
};

// curl, agents and anything else that doesn't ask for HTML get markdown.
const wantsText = (c: Context) => !(c.req.header('accept') ?? '').includes('text/html');
const md = (c: Context, text: string, status: 200 | 404 = 200) =>
  c.body(text, status, { 'content-type': 'text/markdown; charset=utf-8' });

app.get('/health', (c) => c.text('ok'));

// Every URL is looked up among published docs only; nothing reads the disk by URL path.
app.get('*', async (c) => {
  const docs = await load();
  let path = decodeURIComponent(c.req.path).replace(/^\/+|\/+$/g, '');
  const raw = path.endsWith('.md');
  if (raw) path = path.slice(0, -3);
  if (path === 'README') path = '';
  const text = raw || wantsText(c);

  const doc = docs.find((d) => d.path === path) ?? (path === '' ? PLACEHOLDER : undefined);
  if (doc) {
    const name = `${doc.path || 'README'}.md`;
    const markdown = textDoc(doc, toMarkdown(doc, docs));
    if (text) return md(c, (path === '' ? `~/matt $ ls\n${textLs(docs)}\n\n` : '') + markdown);
    return c.html(page({ docs, active: doc.path, cmd: `cat ${name}`, file: name, modified: doc.modified, body: toHtml(markdown) }));
  }

  if (docs.some((d) => d.dir === path)) {
    if (text) return md(c, `~/matt/${path} $ ls\n${textLs(docs, path)}\n`);
    return c.html(page({ docs, active: path, cmd: `ls ${path}/`, file: `${path}/`, body: dirBody(docs, path) }));
  }

  if (text) return md(c, "404 · you've drifted off the sheet\n", 404);
  return c.html(page({ docs, active: '', cmd: `cat ${path}`, file: path, body: `<h1>404</h1><p>You've drifted off the sheet. <a href="/">cd ~</a></p>` }), 404);
});

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port }, () => console.log(`~/matt listening on :${port}, reading ${CONTENT_DIR}`));
