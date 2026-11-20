import Collection from '../../components/collection.js';
export const metadata = { title: 'The collection · Dvogue' };
export default async function Shop({ searchParams }) {
  const params = await searchParams;
  const category = ['Women', 'Men', 'Accessories'].includes(params.category) ? params.category : 'All';
  const query = typeof params.q === 'string' ? params.q.slice(0, 200) : '';
  return <Collection key={category + ':' + query} initialCategory={category} initialQuery={query} />;
}
