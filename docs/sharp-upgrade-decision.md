# sharp 0.35 decision

Direct `sharp` stays on `^0.34.5` (locked at 0.34.5). This pull request does not rewrite committed hero, mentor, or Open Graph images.

`npm audit` still reports high severity for `sharp` at 0.34.5: libvips [GHSA-f88m-g3jw-g9cj](https://github.com/advisories/GHSA-f88m-g3jw-g9cj) and libheif [GHSA-rgj7-g3m4-5g8c](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c). `npm audit fix --force` would install `sharp@0.35.4`. That major is the decision below. Open Graph cards are drawn by `@resvg/resvg-js` in `scripts/generate-og-images.mjs`, not by sharp.

## What 0.35 changes

[sharp 0.35.0](https://sharp.pixelplumbing.com/changelog/v0.35.0/) tunes lossy AVIF with SSIMULACRA2 `iq` metrics. `quality: 58` in `scripts/optimize-images.mjs` does not mean the same thing. `npm run build` runs `seo:assets`, which writes the committed files under `public/images/` and `public/mentors/rhea-bisaria.jpg`.

Compared on 2026-09-23 in this environment (Node 22.14.0), using the same resize and quality settings as `scripts/optimize-images.mjs`:

| File                                               | Committed bytes |               sharp 0.34.5 |                                 sharp 0.35.4 |
| -------------------------------------------------- | --------------: | -------------------------: | -------------------------------------------: |
| `public/images/lbs-ai-lab-workshop-hero-960.avif`  |           43583 |                      43073 |                                        37405 |
| `public/images/lbs-ai-lab-workshop-hero-1280.avif` |           58727 |                      57618 |                                        54795 |
| `public/images/lbs-ai-lab-workshop-hero-1672.avif` |           76341 |                      74917 |                                        76190 |
| hero `.webp` at 960, 1280, and 1672                |       unchanged |                  identical |                                    identical |
| `public/images/lbs-ai-lab-workshop-hero.jpg`       |          150367 | same size, different bytes | same bytes as 0.34.5, not the committed file |
| `public/mentors/rhea-bisaria.jpg`                  |           43053 |                      43055 |                                        43055 |

The 960px hero AVIF drops about 6 KB under 0.35.4. That is a visible pipeline change, not a hash-preserving bump. Locked 0.34.5 in this environment also does not reproduce the committed AVIF or JPEG bytes, so a casual `npm run build` already dirties those files. Do not commit that drift as if it were a reviewed image update.

## What a person does if they want 0.35

1. Install `sharp@0.35.4` on a branch.
2. Run `npm run seo:assets`.
3. Look at the three hero AVIF widths and `rhea-bisaria.jpg` next to the current files.
4. Commit the new binaries only if the quality is acceptable.
5. Re-run `npm run build` and `npm run seo:audit`.

Until that review, leave the direct dependency on 0.34.5. Wrangler may still ship its own sharp 0.35.x. That copy is not what `scripts/optimize-images.mjs` imports.
