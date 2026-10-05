import './globals.css';

export const metadata = {
  title: 'Briefly — AI Content Assistant',
  description: 'Turn your notes into a concise summary and three useful tags.',
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
