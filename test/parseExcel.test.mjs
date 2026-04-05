import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { parseExcel } from '../lib/parseExcel.mjs';

function makeXlsxBuffer(rows) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

test('parses required columns', () => {
  const buf = makeXlsxBuffer([
    ['name', 'description', 'link', 'price', 'image_url', 'category'],
    ['Crib', 'Wood crib', 'http://x/crib', 200, 'http://x/crib.jpg', 'Nursery'],
  ]);
  const rows = parseExcel(buf);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    name: 'Crib',
    description: 'Wood crib',
    link: 'http://x/crib',
    price: 200,
    image_url: 'http://x/crib.jpg',
    category: 'Nursery',
  });
});

test('skips rows with blank name', () => {
  const buf = makeXlsxBuffer([
    ['name', 'description', 'link', 'price', 'image_url', 'category'],
    ['', 'orphan', '', '', '', ''],
    ['Bottle', '', '', '', '', 'Feeding'],
  ]);
  const rows = parseExcel(buf);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'Bottle');
});

test('maps missing optional cells to null', () => {
  const buf = makeXlsxBuffer([
    ['name', 'description', 'link', 'price', 'image_url', 'category'],
    ['Hat', '', '', '', '', ''],
  ]);
  const rows = parseExcel(buf);
  assert.equal(rows[0].description, null);
  assert.equal(rows[0].price, null);
  assert.equal(rows[0].image_url, null);
});

test('throws on missing required header', () => {
  const buf = makeXlsxBuffer([
    ['name', 'description', 'link', 'price'],
    ['Hat', '', '', ''],
  ]);
  assert.throws(() => parseExcel(buf), /missing.*image_url|missing.*category/i);
});

test('coerces price strings to numbers when possible', () => {
  const buf = makeXlsxBuffer([
    ['name', 'description', 'link', 'price', 'image_url', 'category'],
    ['A', '', '', '19.99', '', 'x'],
    ['B', '', '', 'free', '', 'x'],
  ]);
  const rows = parseExcel(buf);
  assert.equal(rows[0].price, 19.99);
  assert.equal(rows[1].price, null);
});
