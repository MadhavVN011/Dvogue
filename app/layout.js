import './globals.css';
import StoreProvider from '../components/store-provider.js';
export const metadata = {
  title: 'Dvogue — Good style. A better story.',
  description: 'A considered fashion collection with product origins, wallet connection, and optional on-chain provenance.',
};
export default function RootLayout({ children }) {
  return <html lang="en"><body><StoreProvider>{children}</StoreProvider></body></html>;
}
