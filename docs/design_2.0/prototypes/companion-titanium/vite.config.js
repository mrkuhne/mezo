import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({ build: { rolldownOptions: { input: { lab: fileURLToPath(new URL('./index.html', import.meta.url)), nap: fileURLToPath(new URL('./nap.html', import.meta.url)) } } } });
