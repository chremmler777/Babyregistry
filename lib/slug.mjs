export function slug(input) {
  const s = String(input ?? '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')  // Remove punctuation
    .replace(/[\s-]+/g, '-')   // Replace spaces and dashes with single dash
    .replace(/^-+|-+$/g, '');  // Trim leading/trailing dashes
  if (!s) throw new Error('slug: empty input');
  return s;
}
