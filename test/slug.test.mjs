import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slug } from '../lib/slug.mjs';

test('lowercases and replaces spaces with dashes', () => {
  assert.equal(slug('Graco Car Seat'), 'graco-car-seat');
});

test('strips punctuation', () => {
  assert.equal(slug("Baby's First Book!"), 'babys-first-book');
});

test('collapses repeated separators', () => {
  assert.equal(slug('Crib   ---  Sheet'), 'crib-sheet');
});

test('trims leading/trailing separators', () => {
  assert.equal(slug('  Hello  '), 'hello');
});

test('handles unicode by stripping non-ascii-alnum', () => {
  assert.equal(slug('Café Latté'), 'caf-latt');
});

test('empty input throws', () => {
  assert.throws(() => slug(''), /empty/i);
  assert.throws(() => slug('   '), /empty/i);
});
