import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// When you add a custom domain, change `site` and add public/CNAME.
export default defineConfig({
  site: 'https://yonglai.github.io',
  integrations: [sitemap()],
  markdown: {
    shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' } },
  },
});
