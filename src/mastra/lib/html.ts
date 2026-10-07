const namedEntities: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  hellip: '\u2026',
  ldquo: '\u201c',
  lsquo: '\u2018',
  lt: '<',
  mdash: '\u2014',
  nbsp: ' ',
  ndash: '\u2013',
  quot: '"',
  rdquo: '\u201d',
  rsquo: '\u2019',
};

function decodeEntities(value: string): string {
  return value.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi,
    (match, code: string) => {
      if (code.startsWith('#')) {
        const hex = code[1] === 'x' || code[1] === 'X';
        const point = Number.parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10);
        return point <= 0x10_ff_ff ? String.fromCodePoint(point) : match;
      }
      return namedEntities[code.toLowerCase()] ?? match;
    }
  );
}

export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();
}
