import { spawn } from "node:child_process";
import {
  access,
  constants,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "js-yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const publicDir = join(rootDir, "public");
const teamsDir = join(rootDir, "src", "content", "teams");
const width = 1200;
const height = 630;

const baseCards = [
  {
    file: "og-default.png",
    eyebrow: "London Business School / Data Science & AI Initiative",
    title: ["Build AI products", "for LBS"],
    body: [
      "A hands-on AI lab for participants building",
      "useful products for LBS workflows",
    ],
    footer: "LBS AI Lab",
  },
  {
    file: "og-spring-2026.png",
    eyebrow: "Spring 2026 Batch in partnership with Google DeepMind",
    title: ["Nine teams building", "AI products for LBS"],
    body: ["9 teams / 22 builders / 4 mentors / 8 weeks"],
    footer: "lbsailab.com/batches/spring-2026",
  },
];

const escapeXml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const textLines = (lines, x, y, size, weight, family, fill, lineHeight) =>
  lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${y + index * lineHeight}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeXml(line)}</text>`,
    )
    .join("");

const wrapText = (text, maxCharacters, maxLines) => {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];

  for (const word of words) {
    const current = lines.at(-1);

    if (!current) {
      lines.push(word);
      continue;
    }

    if (`${current} ${word}`.length <= maxCharacters) {
      lines[lines.length - 1] = `${current} ${word}`;
      continue;
    }

    if (lines.length < maxLines) {
      lines.push(word);
      continue;
    }

    lines[lines.length - 1] = `${current}...`;
    break;
  }

  return lines;
};

const standalonePhrase = (text) => text.replace(/\.$/, "");

const parseTeamFrontmatter = (source, file) => {
  const match = source.match(/^---\n([\s\S]*?)\n---/);

  if (!match) {
    throw new Error(`${file} is missing YAML frontmatter`);
  }

  return load(match[1]);
};

const loadTeamCards = async () => {
  const files = (await readdir(teamsDir))
    .filter((file) => file.endsWith(".md") || file.endsWith(".mdx"))
    .sort();

  const cards = await Promise.all(
    files.map(async (file) => {
      const source = await readFile(join(teamsDir, file), "utf8");
      const data = parseTeamFrontmatter(source, file);
      const displayName = data.displayName || data.name;

      return {
        file: `og-team-${data.slug}.png`,
        eyebrow: `${data.batchLabel} / LBS AI Lab`,
        title: wrapText(displayName, 18, 2),
        body: wrapText(standalonePhrase(data.tagline), 52, 2),
        footer: `lbsailab.com/batches/spring-2026/${data.slug}`,
      };
    }),
  );

  return cards;
};

const makeCard = ({
  eyebrow,
  title,
  body,
  footer,
}) => `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(title.join(" "))}</title>
  <desc id="desc">${escapeXml(body.join(" "))}</desc>
  <rect width="${width}" height="${height}" fill="#fbfaf7"/>
  <rect x="0" y="0" width="${width}" height="16" fill="#17145f"/>
  <rect x="84" y="110" width="44" height="4" fill="#f1111f"/>
  <text x="144" y="118" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="850" fill="#17145f">${escapeXml(eyebrow)}</text>
  ${textLines(title, 84, 245, 86, 900, "Georgia, 'Times New Roman', serif", "#17145f", 88)}
  ${textLines(body, 88, 460, 34, 500, "Inter, Arial, sans-serif", "#343a78", 48)}
  <rect x="84" y="536" width="1032" height="1" fill="#d9dbe8"/>
  <text x="84" y="584" font-family="Inter, Arial, sans-serif" font-size="30" font-weight="850" fill="#17145f">${escapeXml(footer)}</text>
  <circle cx="1076" cy="566" r="28" fill="#17145f"/>
  <path d="M1065 566h21m0 0-8-8m8 8-8 8" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const renderWithSips = async (svg, outputPath) => {
  const tempSvgPath = `${outputPath}.tmp.svg`;
  await writeFile(tempSvgPath, svg);

  try {
    await new Promise((resolve, reject) => {
      const child = spawn("sips", [
        "-s",
        "format",
        "png",
        tempSvgPath,
        "--out",
        outputPath,
      ]);

      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`sips exited with code ${code}`));
        }
      });
    });
  } finally {
    await rm(tempSvgPath, { force: true });
  }
};

const useExistingImage = async (outputPath) => {
  await access(outputPath, constants.R_OK);
  console.warn(`Using existing committed Open Graph image: ${outputPath}`);
};

const renderPng = async (svg, outputPath) => {
  if (process.platform === "darwin") {
    try {
      await renderWithSips(svg, outputPath);
    } catch {
      await useExistingImage(outputPath);
    }
    return;
  }

  try {
    const { Resvg } = await import("@resvg/resvg-js");
    const renderer = new Resvg(svg, {
      fitTo: {
        mode: "width",
        value: width,
      },
    });
    const pngData = renderer.render().asPng();
    await writeFile(outputPath, pngData);
  } catch (error) {
    console.warn(
      `Native SVG renderer unavailable, falling back to sips for ${outputPath}.`,
    );
    try {
      await renderWithSips(svg, outputPath);
    } catch (fallbackError) {
      try {
        await useExistingImage(outputPath);
      } catch {
        throw fallbackError;
      }
    }
  }
};

await mkdir(publicDir, { recursive: true });

const cards = [...baseCards, ...(await loadTeamCards())];

await Promise.all(
  cards.map(async (card) => {
    await renderPng(makeCard(card), join(publicDir, card.file));
  }),
);

console.log(`Generated ${cards.length} Open Graph image assets.`);
