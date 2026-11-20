import test from 'node:test';
import assert from 'node:assert/strict';
import { products, findProducts, productMetadata } from '../lib/catalog.js';
import { sanitizeBag, bagTotal } from '../lib/bag.js';

test('catalog search, categories and pricing use the same collection', () => {
  assert.equal(new Set(products.map(p => p.sku)).size, products.length);
  assert.ok(findProducts({ category: 'Women' }).every(p => p.category === 'Women'));
  assert.ok(findProducts({ query: '  COTTON ' }).length > 0);
  assert.equal(findProducts({ query: 'missing-product' }).length, 0);
  const sorted = findProducts({ sort: 'price-asc' });
  assert.ok(sorted.every((p, i) => i === 0 || p.price >= sorted[i-1].price));
  assert.equal(productMetadata(products[0]).sku, products[0].sku);
});
test('bag rejects corrupted storage, unknown products, invalid sizes and quantities', () => {
  const valid = { sku: 'DV-001', size: 'M', quantity: 2 };
  assert.deepEqual(sanitizeBag(null), []);
  assert.deepEqual(sanitizeBag([{}, null, { ...valid, sku: 'missing' }, { ...valid, size: '<script>' }, { ...valid, quantity: -1 }, { ...valid, quantity: Infinity }, { ...valid, quantity: 1.5 }]), []);
  assert.equal(bagTotal([valid]), products[0].price * 2);
  assert.deepEqual(sanitizeBag([valid, { ...valid, quantity: 10 }]), [{ ...valid, quantity: 10 }]);
});
