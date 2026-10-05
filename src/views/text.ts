// Plain markdown, for curl, agents and anyone who adds .md to a url.
import { resolveLinks, type Doc, type Site } from '../content.ts';
import { inDir, listing } from './ls.ts';

const SPECS: Record<string, string[]> = { made: ['qty', 'material', 'year', 'status'], ideas: ['status', 'date'] };

/** A doc as markdown: a title if the body has none, and (for made/ideas) a one-row parts list. */
export function docMarkdown(doc: Doc, site: Site) {
  const body = resolveLinks(doc, site).trim();
  const head = /^#\s/.test(body) ? '' : `# ${doc.title}\n\n`;
  const keys = (SPECS[doc.dir] ?? []).filter((k) => doc.data[k] != null && doc.data[k] !== '');
  const specs = keys.length
    ? `| ${keys.join(' | ')} |\n|${' --- |'.repeat(keys.length)}\n| ${keys.map((k) => String(doc.data[k])).join(' | ')} |\n\n`
    : '';
  return `${head}${specs}${body}\n`;
}

export function lsText(site: Site, dir = '') {
  if (!dir)
    return listing(site.docs)
      .map((r) => `${r.perm}  ${r.name}${r.dir ? '/' : ''}`.padEnd(32) + r.meta)
      .join('\n');
  return inDir(site.docs, dir)
    .map((d) => `${(d.date ?? '').padEnd(12)}${d.path}.md  ${d.title}`)
    .join('\n');
}

/** `curl matthewbracke.com`: the listing, the README and what I'm on right now. */
export function homeText(readme: Doc, site: Site) {
  const now = site.docs.find((d) => d.path === 'now');
  const nowText = now ? `\n${docMarkdown(now, site).replace(/^# .*/, '## now')}` : '';
  return `~/matt $ ls\n${lsText(site)}\n\n${docMarkdown(readme, site)}${nowText}`;
}

export const dirText = (site: Site, dir: string) => `~/matt/${dir} $ ls\n${lsText(site, dir)}\n`;

/** A short plain-text description for link previews: the first real line of prose. */
export function describe(markdown: string) {
  const line =
    markdown
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l && !/^(#|[-*|>!]|```)/.test(l)) ?? '';
  const text = line.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`]/g, '');
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}
