import { productBySku } from './catalog.js';

export function sanitizeBag(value) {
  if (!Array.isArray(value)) return [];
  const lines = new Map();
  for (const line of value.slice(0, 100)) {
    if (!line || typeof line !== 'object') continue;
    const product = productBySku(line.sku);
    if (!product || !product.sizes.includes(line.size) || !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 10) continue;
    const key = product.sku + ':' + line.size;
    const previous = lines.get(key)?.quantity || 0;
    lines.set(key, { sku: product.sku, size: line.size, quantity: Math.min(10, previous + line.quantity) });
  }
  return [...lines.values()];
}
export function bagTotal(lines) {
  return sanitizeBag(lines).reduce((sum, line) => sum + productBySku(line.sku).price * line.quantity, 0);
}
