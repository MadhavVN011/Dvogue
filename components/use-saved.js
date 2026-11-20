'use client';
import { useMemo, useSyncExternalStore } from 'react';
import { productBySku } from '../lib/catalog.js';
const key = 'dvogue-saved-v1';
let memory = null, memoryOnly = false;
function snapshot() { if (memoryOnly) return memory; try { return localStorage.getItem(key) || memory; } catch { return memory; } }
function serverSnapshot() { return null; }
function subscribe(listener) { window.addEventListener('storage', listener); window.addEventListener('dvogue:saved', listener); return () => { window.removeEventListener('storage', listener); window.removeEventListener('dvogue:saved', listener); }; }
function parse(value) { try { const list = JSON.parse(value || '[]'); return Array.isArray(list) ? [...new Set(list.filter(sku => typeof sku === 'string' && productBySku(sku)))].slice(0, 100) : []; } catch { return []; } }
export function useSaved() {
  const value = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const saved = useMemo(() => parse(value), [value]);
  function toggle(sku) { if (!productBySku(sku)) return; const current = parse(snapshot()); memory = JSON.stringify(current.includes(sku) ? current.filter(item => item !== sku) : [...current, sku]); try { localStorage.setItem(key, memory); memoryOnly = false; } catch { memoryOnly = true; } window.dispatchEvent(new Event('dvogue:saved')); }
  return { saved, toggle };
}
