'use client';
import Link from 'next/link';
import Image from 'next/image';
import { formatPrice } from '../lib/catalog.js';
import { useStore } from './store-provider.js';
import Icon from './icon.js';
export default function ProductCard({ product, priority = false }) {
  const { saved, config } = useStore();
  const selected = saved.saved.includes(product.sku);
  return <article className="product-card"><div className="product-image-wrap"><Link className="product-image" href={'/products/' + product.sku} aria-label={'View ' + product.name}><Image src={product.image} alt={product.name + ' in ' + product.color.toLowerCase()} fill priority={priority} sizes="(max-width: 600px) 45vw, (max-width: 1000px) 44vw, 25vw" /><span className="product-tag">{product.type}</span><span className="quick-view">Discover this piece <Icon name="plus" size={17} /></span></Link><button className={'save-piece ' + (selected ? 'selected' : '')} aria-label={(selected ? 'Unsave ' : 'Save ') + product.name} aria-pressed={selected} onClick={() => saved.toggle(product.sku)}><Icon name="heart" size={18} /></button></div><div className="product-info"><p>{product.category} / {product.color}</p><Link href={'/products/' + product.sku}><h3>{product.name}</h3></Link><span>{formatPrice(product.price)}</span><span className="native-price">{product.cryptoPrice} {config?.currency || 'ETH'} <span>at wallet checkout</span></span></div><Link href={'/products/' + product.sku + '#passport'} className="trace-link"><Icon name="shield" size={13} /> Discover its product passport</Link></article>;
}
