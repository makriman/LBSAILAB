import { getCollection } from "astro:content";
import {
  DEFAULT_OG_IMAGE,
  SEO_UPDATED_AT,
  SPRING_BATCH_OG_IMAGE,
  absoluteUrl,
} from "@utils/seo";
import { defaultDescription, SITE_NAME, SITE_URL } from "@utils/site";

interface SitemapImage {
  loc: string;
  title?: string;
  caption?: string;
}

interface SitemapEntry {
  loc: string;
  images: SitemapImage[];
}

const escapeXml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
const lastModified = new Date(`${SEO_UPDATED_AT}T00:00:00.000Z`).toUTCString();

const imageNode = ({ loc, title, caption }: SitemapImage) => `
    <image:image>
      <image:loc>${escapeXml(absoluteUrl(loc))}</image:loc>${
        title
          ? `
      <image:title>${escapeXml(title)}</image:title>`
          : ""
      }${
        caption
          ? `
      <image:caption>${escapeXml(caption)}</image:caption>`
          : ""
      }
    </image:image>`;

const urlNode = ({ loc, images }: SitemapEntry) => `
  <url>
    <loc>${escapeXml(absoluteUrl(loc))}</loc>${images.map(imageNode).join("")}
  </url>`;

export async function GET() {
  const [teams, mentors] = await Promise.all([
    getCollection("teams"),
    getCollection("mentors"),
  ]);

  const springTeams = teams
    .filter((team) => team.data.batch === "spring-2026")
    .map((team) => ({
      loc: `/batches/spring-2026/${team.data.slug}/`,
      images: [
        {
          loc: team.data.seoImage ?? DEFAULT_OG_IMAGE,
          title: `${team.data.displayName} social share image`,
          caption: team.data.seoDescription ?? team.data.tagline,
        },
      ],
    }));

  const mentorImages = mentors
    .filter((mentor) => Boolean(mentor.data.image))
    .map((mentor) => ({
      loc: mentor.data.image as string,
      title: mentor.data.name,
      caption: mentor.data.focus,
    }));

  const entries: SitemapEntry[] = [
    {
      loc: "/",
      images: [
        {
          loc: "/images/lbs-ai-lab-workshop-hero-1672.webp",
          title: SITE_NAME,
          caption: defaultDescription,
        },
        {
          loc: "/google-deepmind-logo-blue.png",
          title: "Google DeepMind",
          caption: "Spring 2026 Batch partner",
        },
        {
          loc: SPRING_BATCH_OG_IMAGE,
          title: "Spring 2026 Batch social share image",
          caption:
            "LBS AI Lab Spring 2026 Batch in partnership with Google DeepMind",
        },
      ],
    },
    {
      loc: "/batches/",
      images: [
        {
          loc: SPRING_BATCH_OG_IMAGE,
          title: "LBS AI Lab batches social share image",
          caption: "Teams building AI products for LBS workflows",
        },
      ],
    },
    {
      loc: "/batches/spring-2026/",
      images: [
        {
          loc: SPRING_BATCH_OG_IMAGE,
          title: "Spring 2026 Batch social share image",
          caption:
            "Nine LBS AI Lab teams building AI products for LBS workflows",
        },
      ],
    },
    {
      loc: "/mentors/",
      images: mentorImages,
    },
    ...springTeams,
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${entries.map(urlNode).join("")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, must-revalidate",
      "Last-Modified": lastModified,
      "X-Robots-Tag":
        "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1",
      "Access-Control-Allow-Origin": SITE_URL,
    },
  });
}
