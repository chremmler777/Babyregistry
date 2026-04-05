export function slug(input) {
  const s = String(input ?? '')
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!s) throw new Error('slug: empty input');
  return s;
}
