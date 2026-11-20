export const products = [
  { sku: 'DV-001', name: 'The Sunday trench', category: 'Women', type: 'Outerwear', price: 12900, image: '/images/coat.jpg', color: 'Sandstone', material: 'Cotton and linen blend', origin: 'Alentejo, Portugal', maker: 'Atelier Vale', sizes: ['XS', 'S', 'M', 'L', 'XL'], description: 'An easy silhouette for the in-between days. A timeless layer with room to make it your own.' },
  { sku: 'DV-002', name: 'Everyday tailored trousers', category: 'Women', type: 'Trousers', price: 4900, image: '/images/trousers.jpg', color: 'Blush', material: 'Lyocell and cotton blend', origin: 'Bengaluru, India', maker: 'Common Thread Studio', sizes: ['XS', 'S', 'M', 'L', 'XL'], description: 'A relaxed cut, a clean line, and a little extra room to move. Made for wherever the day takes you.' },
  { sku: 'DV-003', name: 'The after-hours jacket', category: 'Men', type: 'Outerwear', price: 15900, image: '/images/jacket.jpg', color: 'Midnight', material: 'Leather with cotton lining', origin: 'Chennai, India', maker: 'Form Workshop', sizes: ['S', 'M', 'L', 'XL'], description: 'A familiar favourite with a sharper edge. Clean detailing, substantial texture, and a fit that gets better with time.' },
  { sku: 'DV-004', name: 'The essential cotton tee', category: 'Men', type: 'Essentials', price: 1900, image: '/images/shirt.jpg', color: 'Cloud', material: '100% cotton', origin: 'Tiruppur, India', maker: 'Everyday Mills', sizes: ['XS', 'S', 'M', 'L', 'XL'], description: 'The starting point for a considered wardrobe. A soft, simple tee designed to be worn on repeat.' },
  { sku: 'DV-005', name: 'The everywhere backpack', category: 'Accessories', type: 'Bags', price: 3900, image: '/images/bag.jpg', color: 'Charcoal', material: 'Polyester canvas', origin: 'New Delhi, India', maker: 'Carry Collective', sizes: ['One size'], description: 'For the everyday essentials and the unexpected extras. Practical pockets meet a beautifully simple shape.' },
  { sku: 'DV-006', name: 'The relaxed poplin shirt', category: 'Women', type: 'Shirts', price: 4200, image: '/images/poplin.jpg', color: 'Ivory', material: '100% cotton poplin', origin: 'Porto, Portugal', maker: 'Atelier Vale', sizes: ['XS', 'S', 'M', 'L', 'XL'], description: 'A little structure, a lot of ease. An everyday shirt that works just as well buttoned up as it does layered.' },
  { sku: 'DV-007', name: 'The open-knit layer', category: 'Women', type: 'Knitwear', price: 5900, image: '/images/knit.jpg', color: 'Ecru', material: 'Cotton knit blend', origin: 'Ludhiana, India', maker: 'Loop Studio', sizes: ['XS', 'S', 'M', 'L'], description: 'Open-knit texture and an easy drape. A light, tactile layer for days that call for a little softness.' },
  { sku: 'DV-008', name: 'The weekend shirt', category: 'Men', type: 'Shirts', price: 6200, image: '/images/weekend-shirt.jpg', color: 'Indigo', material: 'Cotton chambray', origin: 'Jaipur, India', maker: 'Form Workshop', sizes: ['S', 'M', 'L', 'XL'], description: 'An easy layer for unplanned days. Wear it open over a tee or buttoned up on its own.' },
  { sku: 'DV-009', name: 'The occasion dress', category: 'Women', type: 'Dresses', price: 8900, image: '/images/dress.jpg', color: 'Rose', material: 'Viscose blend', origin: 'Mumbai, India', maker: 'Common Thread Studio', sizes: ['XS', 'S', 'M', 'L'], description: 'A flowing shape with a little occasion built in. Simple details leave room for your own finishing touches.' },
  { sku: 'DV-010', name: 'The everyday shoulder bag', category: 'Accessories', type: 'Bags', price: 7400, image: '/images/shoulder.jpg', color: 'Blush', material: 'Leather with cotton lining', origin: 'Kolkata, India', maker: 'Carry Collective', sizes: ['One size'], description: 'A considered companion, from the first coffee to the last train. Just the right size for what matters.' },

];

// Independent fixed demo-chain prices, not a live fiat/crypto conversion.
products.forEach((product, index) => { product.cryptoPrice = ['0.0032','0.0012','0.0040','0.0005','0.0010','0.0011','0.0015','0.0016','0.0022','0.0018'][index]; });

export function productBySku(sku) { return products.find(product => product.sku === sku); }
export function productMetadata(product) {
  return { version: 1, sku: product.sku, name: product.name, material: product.material, origin: product.origin, maker: product.maker };
}
export function findProducts({ query = '', category = 'All', sort = 'featured', type = 'All', size = 'All', maxPrice = Infinity } = {}) {
  const term = query.trim().toLowerCase();
  const found = products.filter(p => (category === 'All' || p.category === category) && (type === 'All' || p.type === type) && (size === 'All' || p.sizes.includes(size)) && p.price <= maxPrice && [p.name, p.material, p.type, p.origin].join(' ').toLowerCase().includes(term));
  if (sort === 'price-asc') found.sort((a, b) => a.price - b.price);
  if (sort === 'price-desc') found.sort((a, b) => b.price - a.price);
  return found;
}
export function formatPrice(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}
