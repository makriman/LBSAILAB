// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  site: "https://lbsailab.com",
  output: "static",
  integrations: [sitemap()],

  vite: {
    build: {
      cssCodeSplit: true,
    },
  },

  adapter: cloudflare(),
});