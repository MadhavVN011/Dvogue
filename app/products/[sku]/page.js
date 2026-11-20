import { notFound } from 'next/navigation';
import { products, productBySku } from '../../../lib/catalog.js';
import ProductDetail from '../../../components/product-detail.js';
export function generateStaticParams() { return products.map(product => ({ sku: product.sku })); }
export async function generateMetadata({ params }) { const { sku } = await params; const product = productBySku(sku); return { title: product ? product.name + ' · Dvogue' : 'Piece not found · Dvogue', description: product?.description }; }
export default async function Product({ params }) { const { sku } = await params; const product = productBySku(sku); if (!product) notFound(); return <ProductDetail key={sku} product={product} />; }
