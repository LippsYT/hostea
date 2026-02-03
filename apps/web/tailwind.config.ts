import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Newsreader"', 'serif'],
        body: ['"Space Grotesk"', 'sans-serif']
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        muted: 'hsl(var(--muted))',
        accent: 'hsl(var(--accent))',
        primary: 'hsl(var(--primary))',
        card: 'hsl(var(--card))'
      },
      boxShadow: {
        soft: '0 10px 30px rgba(0, 0, 0, 0.08)'
      }
    }
  },
  plugins: []
};

export default config;
