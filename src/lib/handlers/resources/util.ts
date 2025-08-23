export const uriMatchesTemplate = (uri: string, template: string): { ok: boolean; params: Record<string, string> } => {
  const [proto, rest] = uri.split('://');
  const [tProto, tRest] = template.split('://');
  if (!tRest || proto + '://' !== tProto + '://') return { ok: false, params: {} };
  const uriParts = rest.split('/');
  const tplParts = tRest.split('/');
  const params: Record<string, string> = {};
  for (let i = 0, j = 0; i < tplParts.length; i += 1, j += 1) {
    const part = tplParts[i];
    if (part.startsWith('{') && part.endsWith('}')) {
      const key = part.slice(1, -1);
      if (key.startsWith('*')) {
        params[key.slice(1)] = uriParts.slice(j).join('/');
        return { ok: true, params };
      }
      if (uriParts[j] === undefined) return { ok: false, params: {} };
      params[key] = uriParts[j];
      continue;
    }
    if (part !== uriParts[j]) return { ok: false, params: {} };
  }
  return { ok: true, params };
};


