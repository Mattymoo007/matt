// Plain markdown, for curl, agents and anyone who adds .md to a url.
import { resolveLinks, type Doc, type Site } from '../content.ts';
import { inDir, listing, MACHINES } from './ls.ts';

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
  const row = (perm: string, name: string, meta: string) => `${perm}  ${name}`.padEnd(32) + meta;
  if (!dir)
    return [
      ...listing(site.docs).map((r) => row(r.perm, `${r.name}${r.dir ? '/' : ''}`, r.meta)),
      ...MACHINES.map((m) => row('-r--r--r--', m.path, m.meta)),
    ].join('\n');
  const docs = inDir(site.docs, dir);
  const width = Math.max(...docs.map((d) => d.path.length)) + 6; // '/' + '.md' + two spaces
  return docs.map((d) => `${(d.date ?? '').padEnd(12)}${`/${d.path}.md`.padEnd(width)}${d.title}`).join('\n');
}

/** `curl matthewbracke.com`: the listing, the README and what I'm on right now. */
export function homeText(readme: Doc, site: Site) {
  const now = site.docs.find((d) => d.path === 'now');
  const nowText = now ? `\n${docMarkdown(now, site).replace(/^# .*/, '## now')}` : '';
  return `~/matt $ ls\n${lsText(site)}\n\n${docMarkdown(readme, site)}${nowText}`;
}

export const dirText = (site: Site, dir: string) => `~/matt/${dir} $ ls\n${lsText(site, dir)}\n`;

/** Site-relative links and images made absolute, so the markdown still works off the site. */
export const absolute = (markdown: string, origin: string) => markdown.replace(/\]\(\//g, `](${origin}/`);

/** A short plain-text description for link previews: the first real line of prose, or the first list if it comes first. */
export function describe(markdown: string) {
  const lines = markdown
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !/^(#|[|>!]|```)/.test(l));
  const item = (l = '') => l.match(/^[-*]\s+(.+)$/)?.[1];
  const end = lines.findIndex((l) => !item(l));
  const list = lines.slice(0, end < 0 ? undefined : end).map((l) => item(l)!);
  const line = item(lines[0]) ? list.join(' · ') : (lines[0] ?? '');
  const text = line.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`]/g, '');
  return text.length > 160 ? `${text.slice(0, 160).replace(/\W*\s+\S*$/, '')}…` : text; // cut at a word
}
