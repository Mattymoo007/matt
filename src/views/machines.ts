// For machines: the same published docs as llms.txt, RSS, a sitemap and JSON-LD. Built per request, like every page.
import { findImage, imageUrl, resolveLinks, toHtml, type Doc, type Site } from '../content.ts';
import { inDir, ordered, SECTIONS } from './ls.ts';
import { describe, docMarkdown } from './text.ts';

const XML: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
const xml = (s: string) => s.replace(/[&<>"']/g, (c) => XML[c]);

/** Site-relative links and images made absolute, so the markdown still works off the site. */
const absolute = (markdown: string, origin: string) => markdown.replace(/\]\(\//g, `](${origin}/`);
const mdUrl = (d: Doc, origin: string) => `${origin}/${d.path || 'README'}.md`;
const day = (d: Date) => d.toISOString().slice(0, 10);

const intro = (site: Site) => {
  const readme = site.docs.find((d) => d.path === '');
  return { name: readme?.title ?? 'Matt Bracke', lede: readme ? describe(readme.body) : '' };
};

/** llms.txt (llmstxt.org): who this is, then every file with a one-line description. */
export function llmsTxt(site: Site, origin: string) {
  const { name, lede } = intro(site);
  const item = (d: Doc) => {
    const about = describe(d.body);
    return `- [${d.path ? d.title : 'README'}](${mdUrl(d, origin)})${about ? `: ${about}` : ''}`;
  };
  const top = ordered(inDir(site.docs, ''));
  const sections = SECTIONS.map((s) => [s, inDir(site.docs, s)] as const).filter(([, docs]) => docs.length);
  return `# ${name}

${lede ? `> ${lede}\n\n` : ''}A folder of markdown files, written in Obsidian and served as they are. Every page is also plain markdown: add .md to any url, or ask without Accept: text/html. Everything in one file: ${origin}/llms-full.txt

## Start here

${top.map(item).join('\n')}
${sections.map(([s, docs]) => `\n## ${s}\n\n${docs.map(item).join('\n')}\n`).join('')}`;
}

/** llms-full.txt: every published doc, one after the other, each marked with its url. */
export function llmsFull(site: Site, origin: string) {
  const { name, lede } = intro(site);
  const docs = ordered(site.docs).map(
    (d) =>
      `<!-- ${origin}/${d.path}${d.date ? ` · ${d.date}` : ''} -->\n${absolute(docMarkdown(d, site), origin).trim()}\n`,
  );
  return `# ${name}: everything on ${new URL(origin).host}, in one file\n\n${lede ? `> ${lede}\n\n` : ''}---\n\n${docs.join('\n---\n\n')}`;
}

/** RSS 2.0 for notes and ideas, full text, newest first. */
export function rss(site: Site, origin: string) {
  const { name, lede } = intro(site);
  const when = (d: Doc) => (/^\d{4}-\d{2}-\d{2}/.test(d.date ?? '') ? new Date(d.date!.slice(0, 10)) : d.modified);
  const items = site.docs
    .filter((d) => d.dir === 'notes' || d.dir === 'ideas')
    .slice(0, 30)
    .map(
      (d) => `<item>
  <title>${xml(d.title)}</title>
  <link>${origin}/${d.path}</link>
  <guid>${origin}/${d.path}</guid>
  <pubDate>${when(d).toUTCString()}</pubDate>
  <category>${d.dir}</category>
  <description>${xml(toHtml(absolute(resolveLinks(d, site), origin)))}</description>
</item>`,
    );
  return `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${xml(name)}</title>
<link>${origin}/</link>
<description>${xml(lede || name)}</description>
<language>en</language>
<atom:link href="${origin}/rss.xml" rel="self" type="application/rss+xml"/>
${items.join('\n')}
</channel>
</rss>
`;
}

export function sitemap(site: Site, origin: string) {
  const dirs = SECTIONS.map((s) => inDir(site.docs, s)).filter((docs) => docs.length);
  const urls = [
    ...site.docs.map((d) => [d.path, d.modified] as const),
    ...dirs.map((docs) => [docs[0].dir, new Date(Math.max(...docs.map((d) => +d.modified)))] as const),
  ];
  return `<?xml version="1.0" encoding="utf-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([path, modified]) => `<url><loc>${xml(`${origin}/${path}`)}</loc><lastmod>${day(modified)}</lastmod></url>`).join('\n')}
</urlset>
`;
}

export const robots = (origin: string) => `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`;

/**
 * schema.org Person, from the folder: the README's title, lede and photo, the profiles linked in hello.md,
 * and the optional `job_title` and `works_for` properties on README.md.
 */
export function person(readme: Doc, site: Site, origin: string) {
  const hello = site.docs.find((d) => d.path === 'hello');
  const photo = readme.data.photo ? findImage(String(readme.data.photo), site.images) : undefined;
  const sameAs = [...(hello?.body.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g) ?? [])].map((m) => m[1]);
  const { job_title, works_for } = readme.data;
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: readme.title,
    url: `${origin}/`,
    description: describe(readme.body) || undefined,
    image: photo ? origin + imageUrl(photo) : undefined,
    jobTitle: job_title ? String(job_title) : undefined,
    worksFor: works_for ? { '@type': 'Organization', name: String(works_for) } : undefined,
    sameAs: sameAs.length ? sameAs : undefined,
  };
}
