'use client';
import Link from 'next/link';
import { useStore } from './store-provider.js';
import { products } from '../lib/catalog.js';
import ProductCard from './product-card.js';
import Icon from './icon.js';
export default function Wishlist() {
 const { saved } = useStore(); const found = products.filter(p => saved.saved.includes(p.sku));
 return <section className="section-wrap wishlist-page"><div className="page-intro"><p className="eyebrow">KEEP THE GOOD ONES CLOSE</p><h1>Your saved pieces<em>.</em></h1><p>A little collection of things that feel like you. Saved in this browser.</p></div>{found.length ? <div className="product-grid home-products">{found.map(p => <ProductCard key={p.sku} product={p} />)}</div> : <div className="empty-state"><Icon name="heart" size={40} /><h2>A space for your favourites.</h2><p>Tap the heart on a piece to save it for later.</p><Link className="button dark" href="/shop">Explore the collection</Link></div>}</section>;
}
