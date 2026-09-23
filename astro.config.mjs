// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import { SITE_UPDATED_ON } from "./src/site-revision.mjs";

// https://astro.build/config
export default defineConfig({
  site: "https://lbsailab.com",
  output: "static",
  integrations: [
    sitemap({
      serialize(item) {
        return {
          ...item,
          lastmod: SITE_UPDATED_ON,
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
