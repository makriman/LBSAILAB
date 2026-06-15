// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

const SITE_UPDATED_AT = "2026-06-15";

// https://astro.build/config
export default defineConfig({
  site: "https://lbsailab.com",
  output: "static",
  integrations: [
    sitemap({
      serialize(item) {
        return {
          ...item,
          lastmod: SITE_UPDATED_AT,
        };
      },
    }),
  ],
  vite: {
    build: {
      cssCodeSplit: true,
    },
  },
});
