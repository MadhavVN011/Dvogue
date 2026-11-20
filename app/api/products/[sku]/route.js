import { productBySku, productMetadata } from '../../../../lib/catalog.js';
export async function GET(_request, { params }) {
  const { sku } = await params;
  const product = productBySku(sku);
  if (!product) return Response.json({ error: 'Product not found' }, { status: 404 });
  return Response.json(productMetadata(product));
}
