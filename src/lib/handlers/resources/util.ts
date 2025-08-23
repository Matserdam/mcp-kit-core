export const uriMatchesTemplate = (uri: string, template: string): { ok: boolean; params: Record<string, string> } => {
  const [proto, rest] = uri.split('://');
  const [tProto, tRest] = template.split('://');
  if (!tRest || proto + '://' !== tProto + '://') return { ok: false, params: {} };
  // Escape regex special chars except braces
  const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Build regex with named capture groups for {var} and {*rest}
  const pattern = tRest
    .split('/')
    .map(segment => {
      if (segment.includes('{') && segment.includes('}')) {
        // Replace {*name} first (rest matcher)
        segment = segment.replace(/\{\*([a-zA-Z0-9_]+)\}/g, (_m, name) => `(?<${name}>.*)`);
        // Replace {name} (single segment, exclude slash)
        segment = segment.replace(/\{([a-zA-Z0-9_]+)\}/g, (_m, name) => `(?<${name}>[^/]+)`);
        return segment.split(/(\(\?<[^>]+>\.[*]?\)|\(\?<[^>]+>\[^\/\]\+\))/)
          .map(part => part && part.startsWith('(?<') ? part : escapeRegex(part))
          .join('');
      }
      return escapeRegex(segment);
    })
    .join('/');
  const regex = new RegExp(`^${pattern}$`);
  const match = regex.exec(rest);
  if (!match) return { ok: false, params: {} };
  const groups = (match.groups ?? {}) as Record<string, string>;
  return { ok: true, params: groups };
};


