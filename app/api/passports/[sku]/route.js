import { productBySku } from '../../../../lib/catalog.js';
export async function GET(request, { params }) {
  const { sku } = await params;
  const p = productBySku(sku);
  if (!p) return Response.json({ error: 'Product not found' }, { status: 404 });
  const base = new URL(request.url).origin;
  return Response.json({ name: 'Dvogue · ' + p.name, description: 'Digital product passport for the Dvogue sample collection. Physical fulfilment is not provided by this demo.', image: base + p.image, external_url: base + '/products/' + p.sku, attributes: [{ trait_type: 'Product ID', value: p.sku }, { trait_type: 'Material', value: p.material }, { trait_type: 'Origin', value: p.origin }, { trait_type: 'Maker', value: p.maker }] });
}
