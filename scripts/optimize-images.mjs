import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourceDir = path.join(root, "src", "assets");
const publicDir = path.join(root, "public");
const heroInput = path.join(
  sourceDir,
  "images",
  "lbs-ai-lab-workshop-hero.png",
);
const heroBase = path.join(publicDir, "images", "lbs-ai-lab-workshop-hero");
const mentorInput = path.join(sourceDir, "mentors", "rhea-bisaria.png");
const mentorOutput = path.join(publicDir, "mentors", "rhea-bisaria.jpg");

await mkdir(path.dirname(heroBase), { recursive: true });

const heroWidths = [960, 1280, 1672];

await Promise.all([
  ...heroWidths.map((width) =>
    sharp(heroInput)
      .resize({ width, withoutEnlargement: true })
      .avif({ effort: 5, quality: 58 })
      .toFile(`${heroBase}-${width}.avif`),
  ),
  ...heroWidths.map((width) =>
    sharp(heroInput)
      .resize({ width, withoutEnlargement: true })
      .webp({ effort: 5, quality: 78 })
      .toFile(`${heroBase}-${width}.webp`),
  ),
  sharp(heroInput)
    .jpeg({ mozjpeg: true, quality: 78 })
    .toFile(`${heroBase}.jpg`),
  sharp(mentorInput).jpeg({ mozjpeg: true, quality: 80 }).toFile(mentorOutput),
]);

console.log("Generated optimized image assets.");
