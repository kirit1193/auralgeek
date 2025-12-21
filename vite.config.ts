import { defineConfig } from 'vite';

export default defineConfig({
  // Cloudflare Pages serves from /; keep defaults.
  // Worker imports (new URL(...)) are supported out of the box.
});
