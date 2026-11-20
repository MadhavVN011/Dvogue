'use client';
import { useMemo, useSyncExternalStore } from 'react';
import { sanitizeBag } from '../lib/bag.js';

const key = 'dvogue-bag-v1';
let memory = null;
let memoryOnly = false;
function snapshot() {
  if (memoryOnly) return memory;
  try { return localStorage.getItem(key) ?? memory; } catch { return memory; }
}
function subscribe(listener) {
  window.addEventListener('storage', listener);
  window.addEventListener('dvogue:bag', listener);
  return () => { window.removeEventListener('storage', listener); window.removeEventListener('dvogue:bag', listener); };
}
function serverSnapshot() { return null; }
function parse(value) { try { return sanitizeBag(JSON.parse(value || '[]')); } catch { return []; } }
function save(lines) {
  memory = JSON.stringify(sanitizeBag(lines));
  try { localStorage.setItem(key, memory); memoryOnly = false; } catch { memoryOnly = true; }
  window.dispatchEvent(new Event('dvogue:bag'));
}
  function completePurchase(purchased) {
    const current = parse(snapshot()).map(line => {
      const bought = purchased.find(item => item.sku === line.sku && item.size === line.size);
      return { ...line, quantity: line.quantity - (bought?.quantity || 0) };
    }).filter(line => line.quantity > 0);
    save(current);
  }
export function useBag() {
  const value = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const lines = useMemo(() => parse(value), [value]);
  function add(sku, size) {
    const current = parse(snapshot());
    const line = current.find(item => item.sku === sku && item.size === size);
    if (line) line.quantity = Math.min(10, line.quantity + 1);
    else current.push({ sku, size, quantity: 1 });
    save(current);
  }
  function update(sku, size, quantity) {
    const current = parse(snapshot()).map(line => line.sku === sku && line.size === size ? { ...line, quantity } : line).filter(line => line.quantity > 0);
    save(current);
  }
  return { lines, add, update, completePurchase };
}
