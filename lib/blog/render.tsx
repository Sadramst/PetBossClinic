import type { ReactNode } from 'react';

/**
 * Minimal, safe article renderer. Admins write plain text with a few Markdown
 * conventions; we build React elements (never raw HTML), so content cannot inject
 * scripts.
 *
 *   ## Heading / ### Sub-heading
 *   - bullet item            1. numbered item
 *   > tip / note
 *   **bold**   [link text](/shop/cat-dry-food or https://...)
 *   blank line = new paragraph
 */
type Block =
  | { type: 'h2' | 'h3' | 'p' | 'quote'; text: string }
  | { type: 'ul' | 'ol'; items: string[] };

export function parseArticle(source: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { type: 'ul' | 'ol'; items: string[] } | null = null;

  const flush = () => {
    if (para.length) blocks.push({ type: 'p', text: para.join(' ') });
    if (list) blocks.push(list);
    para = [];
    list = null;
  };

  for (const raw of source.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^(#{2,3})\s+(.+)$/))) {
      flush();
      blocks.push({ type: m[1].length === 2 ? 'h2' : 'h3', text: m[2] });
    } else if ((m = line.match(/^[-*•]\s+(.+)$/)) || (m = line.match(/^[0-9۰-۹]+[.)]\s+(.+)$/))) {
      const type = /^[-*•]/.test(line) ? 'ul' : 'ol';
      if (para.length) {
        blocks.push({ type: 'p', text: para.join(' ') });
        para = [];
      }
      if (!list || list.type !== type) {
        if (list) blocks.push(list);
        list = { type, items: [] };
      }
      list.items.push(m[1]);
    } else if ((m = line.match(/^>\s?(.+)$/))) {
      flush();
      blocks.push({ type: 'quote', text: m[1] });
    } else {
      if (list) {
        blocks.push(list);
        list = null;
      }
      para.push(line);
    }
  }
  flush();
  return blocks;
}

/** Headings for a table of contents (h2 only). */
export function articleHeadings(source: string): { id: string; text: string }[] {
  return parseArticle(source)
    .filter((b): b is { type: 'h2'; text: string } => b.type === 'h2')
    .map((b, i) => ({ id: `section-${i + 1}`, text: stripInline(b.text) }));
}

export function stripInline(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '$1');
}

function safeHref(href: string): string | null {
  if (href.startsWith('/') && !href.startsWith('//')) return href;
  if (/^https?:\/\//i.test(href)) return href;
  return null;
}

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<strong key={k++}>{m[1]}</strong>);
    else {
      const href = safeHref(m[3]);
      out.push(
        href ? (
          <a key={k++} href={href} className="text-primary underline underline-offset-4" {...(href.startsWith('http') && { target: '_blank', rel: 'noopener' })}>
            {m[2]}
          </a>
        ) : (
          m[2]
        )
      );
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function ArticleBody({ source }: { source: string }) {
  let h2 = 0;
  return (
    <div className="space-y-5 text-[15px] leading-8 text-foreground/90">
      {parseArticle(source).map((b, i) => {
        switch (b.type) {
          case 'h2':
            h2 += 1;
            return (
              <h2 key={i} id={`section-${h2}`} className="text-xl font-black pt-4 scroll-mt-40">
                {inline(b.text)}
              </h2>
            );
          case 'h3':
            return <h3 key={i} className="text-lg font-bold pt-2">{inline(b.text)}</h3>;
          case 'quote':
            return (
              <blockquote key={i} className="rounded-2xl border-s-4 border-primary bg-primary/5 px-5 py-4 text-sm">
                {inline(b.text)}
              </blockquote>
            );
          case 'ul':
          case 'ol': {
            const List = b.type;
            return (
              <List key={i} className={`space-y-2 ps-6 ${b.type === 'ul' ? 'list-disc' : 'list-decimal'} marker:text-primary`}>
                {b.items.map((it, j) => (
                  <li key={j}>{inline(it)}</li>
                ))}
              </List>
            );
          }
          default:
            return <p key={i}>{inline(b.text)}</p>;
        }
      })}
    </div>
  );
}

/** Rough reading time in minutes for Persian text (~200 words/min). */
export function readingMinutes(source: string): number {
  return Math.max(1, Math.round(source.split(/\s+/).filter(Boolean).length / 200));
}
