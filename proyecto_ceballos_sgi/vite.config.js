import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// CSP solo en el build: en desarrollo Vite necesita scripts inline para HMR.
// Los iconos están empaquetados; solo la fuente Work Sans viene de Google
// (si no hay internet se usa la fuente del sistema).
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
].join('; ');

function cspPlugin() {
  return {
    name: 'inject-csp',
    apply: 'build',
    transformIndexHtml: (html) =>
      html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n  <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), cspPlugin()],
  root: path.resolve(__dirname, 'src/renderer'),
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
});
