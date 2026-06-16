import { getCollection } from "astro:content";
import { sortTeamsByBatchList } from "@utils/collections";
import { SEO_UPDATED_AT, absoluteUrl } from "@utils/seo";
import {
  DSAI_URL,
  GOOGLE_DEEPMIND_URL,
  LBS_URL,
  SITE_NAME,
  SITE_URL,
  defaultDescription,
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

function bullet(label: string, value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  return `- ${label}: ${clean(String(value))}`;
}

function link(label: string, pathOrUrl: string, description?: string) {
  const suffix = description ? `: ${clean(description)}` : "";
  return `- [${label}](${absoluteUrl(pathOrUrl)})${suffix}`;
}

export async function GET() {
  const [teams, batches, mentors] = await Promise.all([
    getCollection("teams"),
    getCollection("batches"),
    getCollection("mentors"),
  ]);
  const springBatch = batches.find((batch) => batch.data.id === "spring-2026");
  const autumnBatch = batches.find((batch) => batch.data.id === "autumn-2026");
  const springTeams = springBatch
    ? sortTeamsByBatchList(
        teams.filter((team) => team.data.batch === springBatch.data.id),
        springBatch.data.teams,
      )
    : teams;

  const teamSections = springTeams.flatMap((team) => {
    const building = team.data.building;
    return [
      `### ${team.data.displayName}`,
      bullet("URL", absoluteUrl(`/batches/spring-2026/${team.data.slug}/`)),
      bullet("Focus area", team.data.category),
      bullet("Status", team.data.status),
      bullet("Summary", team.data.summary),
      bullet("Product link", team.data.productUrl),
      bullet("User need", building?.userNeed),
      bullet("Product approach", building?.productApproach),
      bullet("Next step", building?.nextStep),
      "",
    ].filter((line): line is string => line !== null);
  });

  const mentorLines = mentors.map((mentor) =>
    link(
      mentor.data.name,
      `/mentors/#mentor-${mentor.data.id}`,
      `${mentor.data.mentorType ?? mentor.data.role} - ${mentor.data.focus}`,
    ),
  );

  const lines = [
    `# ${SITE_NAME} Full AI Discovery Context`,
    "",
    `> ${defaultDescription}.`,
    "",
    "This file gives AI assistants and crawlers a concise, canonical map of the public LBS AI Lab website. The canonical production domain is https://lbsailab.com.",
    "",
    "## Institutional Context",
    `- Site name: ${SITE_NAME}`,
    `- Canonical domain: ${SITE_URL}`,
    `- Parent institution: London Business School (${LBS_URL})`,
    `- Initiative: Data Science & AI Initiative (${DSAI_URL})`,
    `- Spring 2026 Batch partner: Google DeepMind (${GOOGLE_DEEPMIND_URL})`,
    "- Purpose: help the LBS student community get more involved in AI solution development at the School",
    "- Model: 8-week batch cycles for discovery, product development, evaluation, and iteration",
    "",
    "## Canonical Public Pages",
    link("Home", "/", defaultDescription),
    link(
      "About",
      "/about/",
      "The Lab's purpose, participant benefit, and batch model",
    ),
    link(
      "Batches",
      "/batches/",
      "Directory of batches and Spring 2026 team pages",
    ),
    link(
      "Spring 2026 Batch",
      "/batches/spring-2026/",
      "Focused directory for Spring 2026 Batch teams",
    ),
    link(
      "Mentors",
      "/mentors/",
      "Academic lead and product and technical mentors",
    ),
    link("Apply", "/apply/", "Register interest for the next batch"),
    link("Contact", "/contact/", "Contact routes for Lab enquiries"),
    link("HTML sitemap", "/sitemap/", "Crawlable public site directory"),
    "",
    "## Batch Data",
    `### ${springBatch?.data.name ?? "Spring 2026 Batch"}`,
    bullet("URL", absoluteUrl("/batches/spring-2026/")),
    bullet("Status", springBatch?.data.status),
    bullet("Start date", springBatch?.data.startsAt),
    bullet("End date", springBatch?.data.endsAt),
    bullet("Teams", springBatch?.data.teamCount),
    bullet("Builders", springBatch?.data.participantCount),
    bullet("Mentors", springBatch?.data.mentorCount),
    bullet("Partner", springBatch?.data.partnerName),
    "",
    `### ${autumnBatch?.data.name ?? "Autumn 2026 Batch"}`,
    bullet("URL", absoluteUrl("/batches/#autumn-2026")),
    bullet("Status", autumnBatch?.data.status),
    bullet("Opens", "September 2026"),
    "",
    "## Spring 2026 Team Pages",
    ...teamSections,
    "## Academic Lead And Mentors",
    link(
      "Kostis Christodoulou",
      "/mentors/#academic-lead-kostis-christodoulou",
      "Academic lead supporting the academic direction of the Lab",
    ),
    ...mentorLines,
    "",
    "## Technical Discovery Files",
    link("llms.txt", "/llms.txt", "Short AI discovery file"),
    link("llms-full.txt", "/llms-full.txt", "Full AI discovery file"),
    link("XML sitemap index", "/sitemap-index.xml", "Canonical XML sitemap"),
    link("Image sitemap", "/image-sitemap.xml", "Image discovery sitemap"),
    link("Atom feed", "/feed.xml", "Public page and team feed"),
    link("Robots.txt", "/robots.txt", "Crawler directives"),
    "",
  ].filter((line): line is string => line !== null);

  return new Response(`${lines.join("\n")}`, { headers: textHeaders });
}
