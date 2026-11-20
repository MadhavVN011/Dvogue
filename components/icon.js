export default function Icon({ name, size = 20, ...props }) {
  const paths = {
    heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8',
    hanger: 'M9 6a3 3 0 1 1 3 3v3l9 6v2H3v-2l9-6',
    copy: 'M8 8h13v13H8z M16 8V3H3v13h5',
    search: 'm21 21-5-5 M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0',
    bag: 'M5 7h14l1 14H4L5 7 M9 8V6a3 3 0 0 1 6 0v2',
    wallet: 'M21 8H5a3 3 0 0 1 0-6h14v6 M3 5v14a2 2 0 0 0 2 2h16V8 M21 12h-5v5h5',
    close: 'm6 6 12 12 M6 18 18 6',
    check: 'm5 12 4 4L19 6',
    leaf: 'M20 3C7 2 2 8 6 15c7 6 14 1 14-12 M4 21 15 10',
    globe: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M3 12h18 M12 3c5 5 5 13 0 18-5-5-5-13 0-18',
    shield: 'm12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6l8-4 m-4 10 3 3 5-6',
    plus: 'M12 5v14 M5 12h14', minus: 'M5 12h14',
    menu: 'M4 6h16 M4 12h16 M4 18h16', chevron: 'm9 5 7 7-7 7',
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name] || paths.leaf} /></svg>;
}
