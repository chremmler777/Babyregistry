import * as XLSX from 'xlsx';

const REQUIRED = ['name', 'description', 'link', 'price', 'image_url', 'category'];

function cellToString(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function cellToNumber(v) {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'number') return v;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
}

export function parseExcel(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (aoa.length === 0) return [];
  const header = aoa[0].map((h) => String(h).trim().toLowerCase());
  const missing = REQUIRED.filter((r) => !header.includes(r));
  if (missing.length) {
    throw new Error(`parseExcel: missing required column(s): ${missing.join(', ')}`);
  }
  const idx = Object.fromEntries(REQUIRED.map((k) => [k, header.indexOf(k)]));
  const out = [];
  for (let i = 1; i < aoa.length; i++) {
    const row = aoa[i];
    const name = cellToString(row[idx.name]);
    if (!name) continue;
    out.push({
      name,
      description: cellToString(row[idx.description]),
      link: cellToString(row[idx.link]),
      price: cellToNumber(row[idx.price]),
      image_url: cellToString(row[idx.image_url]),
      category: cellToString(row[idx.category]),
    });
  }
  return out;
}
