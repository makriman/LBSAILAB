import { getCollection } from "astro:content";
import { sortTeamsByBatchList } from "@utils/collections";
import { SEO_UPDATED_AT, absoluteUrl } from "@utils/seo";
import { defaultDescription, SITE_NAME, SITE_URL } from "@utils/site";

interface FeedEntry {
  title: string;
  path: string;
  summary: string;
  updated?: string;
}

const isoDate = (date: string) =>
  new Date(date.length === 10 ? `${date}T00:00:00.000Z` : date).toISOString();
const lastModified = new Date(`${SEO_UPDATED_AT}T00:00:00.000Z`).toUTCString();

const escapeXml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const entryNode = ({ title, path, summary, updated }: FeedEntry) => {
  const url = absoluteUrl(path);

  return `
  <entry>
    <title>${escapeXml(title)}</title>
    <link href="${escapeXml(url)}" />
    <id>${escapeXml(url)}</id>
    <updated>${isoDate(updated ?? SEO_UPDATED_AT)}</updated>
    <summary>${escapeXml(summary)}</summary>
  </entry>`;
};

export async function GET() {
  const [teams, batches] = await Promise.all([
    getCollection("teams"),
    getCollection("batches"),
  ]);
  const springBatch = batches.find((batch) => batch.data.id === "spring-2026");
  const springTeams = springBatch
    ? sortTeamsByBatchList(
        teams.filter((team) => team.data.batch === springBatch.data.id),
        springBatch.data.teams,
      )
    : teams;
  const updated = isoDate(SEO_UPDATED_AT);

  const entries: FeedEntry[] = [
    {
      title: SITE_NAME,
      path: "/",
      summary: defaultDescription,
      updated: SEO_UPDATED_AT,
    },
    {
      title: "About LBS AI Lab",
      path: "/about/",
      summary:
        "LBS AI Lab helps participants get involved in AI solution development at London Business School",
      updated: SEO_UPDATED_AT,
    },
    {
      title: "Batches",
      path: "/batches/",
      summary:
        "LBS AI Lab batches bring together participants for an 8-week cycle of discovery, product development, evaluation, and iteration",
      updated: SEO_UPDATED_AT,
    },
    {
      title: "Spring 2026 Batch",
      path: "/batches/spring-2026/",
      summary:
        "Meet the Spring 2026 Batch of LBS AI Lab teams building AI products for LBS workflows",
      updated: springBatch?.data.updatedAt ?? SEO_UPDATED_AT,
    },
    ...springTeams.map((team) => ({
      title: team.data.displayName,
      path: `/batches/spring-2026/${team.data.slug}/`,
      summary: team.data.seoDescription ?? team.data.tagline,
      updated: team.data.updatedAt,
    })),
    {
      title: "Mentors",
      path: "/mentors/",
      summary:
        "Meet the product and technical mentors supporting LBS AI Lab teams",
      updated: SEO_UPDATED_AT,
    },
    {
      title: "Apply",
      path: "/apply/",
      summary:
        "Apply to join the next LBS AI Lab batch and build AI products for LBS workflows",
      updated: SEO_UPDATED_AT,
    },
    {
      title: "Contact",
      path: "/contact/",
      summary:
        "Contact LBS AI Lab for questions about batches, mentoring, partnerships, user testing, or participant-built AI products",
      updated: SEO_UPDATED_AT,
    },
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(SITE_NAME)}</title>
  <subtitle>${escapeXml(defaultDescription)}</subtitle>
  <link href="${escapeXml(absoluteUrl("/feed.xml"))}" rel="self" />
  <link href="${escapeXml(`${SITE_URL}/`)}" />
  <id>${escapeXml(`${SITE_URL}/`)}</id>
  <updated>${updated}</updated>
  <author>
    <name>London Business School</name>
  </author>${entries.map(entryNode).join("")}
</feed>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, must-revalidate",
      "Last-Modified": lastModified,
      "X-Robots-Tag":
        "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1",
      "Access-Control-Allow-Origin": SITE_URL,
    },
  });
}
