import { getCollection } from "astro:content";
import { sortTeamsByBatchList } from "@utils/collections";
import { SEO_UPDATED_AT, absoluteUrl } from "@utils/seo";
import {
  defaultDescription,
  DSAI_URL,
  GOOGLE_DEEPMIND_URL,
  LBS_URL,
  SITE_NAME,
  SITE_URL,
} from "@utils/site";

export const prerender = true;

const lastModified = new Date(`${SEO_UPDATED_AT}T00:00:00.000Z`).toUTCString();
const textHeaders = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "public, max-age=300, must-revalidate",
  "Last-Modified": lastModified,
  "X-Robots-Tag":
    "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1",
  "Access-Control-Allow-Origin": SITE_URL,
};

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function link(label: string, pathOrUrl: string, description: string) {
  return `- [${label}](${absoluteUrl(pathOrUrl)}): ${clean(description)}`;
}

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

  const lines = [
    `# ${SITE_NAME}`,
    "",
    `> ${defaultDescription}.`,
    "",
    `${SITE_NAME} is a hands-on AI lab for the London Business School community. It helps participants get involved in AI solution development at the School, from identifying opportunities to prototyping and deploying useful products for the LBS community.`,
    "",
    "The Spring 2026 Batch was run in partnership with Google DeepMind.",
    "",
    "## Primary Pages",
    link("Home", "/", defaultDescription),
    link(
      "About LBS AI Lab",
      "/about/",
      "How the Lab helps participants get involved in AI solution development at London Business School",
    ),
    link(
      "Batches",
      "/batches/",
      "An 8-week batch model for teams building AI products for LBS workflows",
    ),
    link(
      "Spring 2026 Batch",
      "/batches/spring-2026/",
      "Nine teams building AI products for LBS workflows",
    ),
    link(
      "Mentors",
      "/mentors/",
      "Product, technical, and academic guidance for LBS AI Lab teams",
    ),
    link("Apply", "/apply/", "Register interest for the Autumn 2026 Batch"),
    link(
      "Contact",
      "/contact/",
      "Contact LBS AI Lab about batches, mentoring, partnerships, and participant-built AI products",
    ),
    "",
    "## Spring 2026 Batch Teams",
    ...springTeams.map((team) =>
      link(
        team.data.displayName,
        `/batches/spring-2026/${team.data.slug}/`,
        team.data.seoDescription ?? team.data.tagline,
      ),
    ),
    "",
    "## Related Institutional Links",
    link("London Business School", LBS_URL, "The parent institution"),
    link(
      "Data Science & AI Initiative",
      DSAI_URL,
      "The London Business School initiative connected to the Lab",
    ),
    link("Google DeepMind", GOOGLE_DEEPMIND_URL, "Spring 2026 Batch partner"),
    "",
    "## Technical Discovery",
    link("Full AI discovery file", "/llms-full.txt", "Extended site context"),
    link("XML sitemap", "/sitemap-index.xml", "Canonical public page sitemap"),
    link("Image sitemap", "/image-sitemap.xml", "Canonical image sitemap"),
    link("Atom feed", "/feed.xml", "Updated public page and team feed"),
    "",
  ];

  return new Response(`${lines.join("\n")}`, { headers: textHeaders });
}
