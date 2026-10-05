// Routes. Every URL is looked up among published docs and scanned images only: nothing reads the disk by URL path.
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono, type Context } from 'hono';
import { CONTENT_DIR, isImage, load, type Doc, type Site } from './content.ts';
import type { Req } from './views/layout.ts';
import { llmsFull, llmsTxt, robots, rss, sitemap } from './views/machines.ts';
import { dirPage, filePage, homePage, missingPage } from './views/pages.ts';
import { dirText, docMarkdown, homeText } from './views/text.ts';

// Shown until README.md in the folder is published.
const PLACEHOLDER: Doc = {
  path: '',
  file: 'README.md',
  dir: '',
  title: 'Matt Bracke',
  data: {},
  modified: new Date(),
  body: '# Matt Bracke\n\n`~/matt` is being built in public: [github.com/Mattymoo007/matt](https://github.com/Mattymoo007/matt).\n',
};

const IMAGE_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
};

// curl, agents and anything else that doesn't ask for HTML get markdown.
const wantsText = (c: Context) => !(c.req.header('accept') ?? '').includes('text/html');
const markdown = (c: Context, text: string, status: 200 | 404 = 200) =>
  c.body(text, status, { 'content-type': 'text/markdown; charset=utf-8' });

/** Where the request came from, for absolute urls and the curl example. */
function request(c: Context): Req {
  const host = c.req.header('host') ?? 'matthewbracke.com';
  return { host, origin: `${c.req.header('x-forwarded-proto') ?? 'http'}://${host}` };
}

export const app = new Hono();

app.get('/health', (c) => c.text('ok'));

app.use('/assets/*', async (c, next) => {
  await next();
  if (c.res.ok) c.header('cache-control', 'public, max-age=31536000, immutable'); // urls carry ?v=
});
app.use('/assets/*', serveStatic({ root: './' }));

// For machines. Same folder, same gate: everything is built from load().
const machine = (type: string, build: (site: Site, origin: string) => string) => async (c: Context) =>
  c.body(build(await load(), request(c).origin), 200, { 'content-type': `${type}; charset=utf-8` });
app.get('/llms.txt', machine('text/plain', llmsTxt));
app.get('/llms-full.txt', machine('text/plain', llmsFull));
app.get('/rss.xml', machine('application/rss+xml', rss));
app.get('/sitemap.xml', machine('application/xml', sitemap));
app.get('/robots.txt', (c) => c.text(robots(request(c).origin)));

app.get('*', async (c) => {
  const site = await load();
  let path = decodeURIComponent(c.req.path).replace(/^\/+|\/+$/g, '');

  if (isImage(path)) {
    if (!site.images.includes(path)) return c.text('not found\n', 404);
    return c.body(await readFile(join(CONTENT_DIR, path)), 200, {
      'content-type': IMAGE_TYPES[extname(path).toLowerCase()],
      'cache-control': 'public, max-age=3600',
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'", // svgs can't run scripts
    });
  }

  const raw = path.endsWith('.md');
  if (raw) path = path.slice(0, -3);
  if (path === 'README') path = '';
  const text = raw || wantsText(c);
  const req = request(c);

  const doc = site.docs.find((d) => d.path === path) ?? (path === '' ? PLACEHOLDER : undefined);
  if (doc && path === '') return text ? markdown(c, homeText(doc, site)) : c.html(homePage(doc, site, req));
  if (doc) return text ? markdown(c, docMarkdown(doc, site)) : c.html(filePage(doc, site, req));
  if (site.docs.some((d) => d.dir === path))
    return text ? markdown(c, dirText(site, path)) : c.html(dirPage(path, site, req));
  return text
    ? markdown(c, `cat: ${path}: No such file or directory\n`, 404)
    : c.html(missingPage(path, site, req), 404);
});

if (import.meta.main) {
  const port = Number(process.env.PORT ?? 3000);
  serve({ fetch: app.fetch, port }, () => console.log(`~/matt listening on :${port}, reading ${CONTENT_DIR}`));
}
