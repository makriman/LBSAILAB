import {
  defaultDescription,
  DSAI_URL,
  GOOGLE_DEEPMIND_URL,
  LBS_URL,
  SITE_NAME,
  SITE_URL,
} from "@utils/site";

export const SEO_UPDATED_AT = "2026-06-16";
export const SEO_UPDATED_AT_ISO = "2026-06-16T00:00:00.000Z";
export const DEFAULT_ROBOTS =
  "index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1";
export const DEFAULT_OG_IMAGE = "/og-default.png";
export const SPRING_BATCH_OG_IMAGE = "/og-spring-2026.png";
export const DEFAULT_OG_IMAGE_ALT =
  "LBS AI Lab social share card for London Business School AI product development";
export const SPRING_BATCH_OG_IMAGE_ALT =
  "Spring 2026 Batch social share card for LBS AI Lab in partnership with Google DeepMind";
export const ORGANIZATION_LOGO = "/favicon/apple-touch-icon.png";
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
export const OG_IMAGE_TYPE = "image/png";
export const SITE_NAVIGATION_ITEMS = [
  { name: "About", path: "/about/" },
  { name: "Batches", path: "/batches/" },
  { name: "Spring 2026 Batch", path: "/batches/spring-2026/" },
  { name: "Mentors", path: "/mentors/" },
  { name: "Apply", path: "/apply/" },
  { name: "Contact", path: "/contact/" },
  { name: "Sitemap", path: "/sitemap/" },
];

export function teamOgImage(slug: string) {
  return `/og-team-${slug}.png`;
}

export type JsonLd = Record<string, unknown>;

export interface BreadcrumbItem {
  name: string;
  path: string;
}

interface PageJsonLdOptions {
  title: string;
  description: string;
  path: string;
  breadcrumbs?: BreadcrumbItem[];
  image?: string;
  updatedAt?: string;
}

interface ItemListEntry {
  id?: string;
  name: string;
  url: string;
  type?: string;
  description?: string;
  image?: string;
}

interface TeamMemberJsonLdInput {
  name: string;
  role: string;
}

interface TeamProfileJsonLdOptions {
  name: string;
  description: string;
  path: string;
  category: string;
  members: TeamMemberJsonLdInput[];
  productUrl?: string;
}

interface PersonJsonLdOptions {
  id: string;
  name: string;
  description?: string;
  image?: string;
  jobTitle?: string;
  sameAs?: string;
  url?: string;
  worksFor?: string;
}

export function absoluteUrl(pathOrUrl: string | URL) {
  return new URL(pathOrUrl.toString(), SITE_URL).toString();
}

export function organizationJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    alternateName: "London Business School AI Lab",
    url: `${SITE_URL}/`,
    description: defaultDescription,
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl(ORGANIZATION_LOGO),
      width: 180,
      height: 180,
    },
    image: {
      "@type": "ImageObject",
      url: absoluteUrl(DEFAULT_OG_IMAGE),
      width: OG_IMAGE_WIDTH,
      height: OG_IMAGE_HEIGHT,
    },
    knowsAbout: [
      "AI product development",
      "AI-assisted application development",
      "London Business School workflows",
      "Product prototyping",
      "Applied AI education",
    ],
    parentOrganization: {
      "@type": "CollegeOrUniversity",
      "@id": `${LBS_URL}#organization`,
      name: "London Business School",
      url: LBS_URL,
    },
    department: {
      "@type": "Organization",
      "@id": `${DSAI_URL}#organization`,
      name: "Data Science & AI Initiative",
      url: DSAI_URL,
    },
  };
}

export function websiteJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    description: defaultDescription,
    inLanguage: "en-GB",
    publisher: {
      "@id": `${SITE_URL}/#organization`,
    },
  };
}

export function siteNavigationJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "SiteNavigationElement",
    "@id": `${SITE_URL}/#site-navigation`,
    name: "LBS AI Lab site navigation",
    url: `${SITE_URL}/`,
    hasPart: SITE_NAVIGATION_ITEMS.map((item) => ({
      "@type": "SiteNavigationElement",
      name: item.name,
      url: absoluteUrl(item.path),
    })),
  };
}

export function webPageJsonLd({
  title,
  description,
  path,
  image = DEFAULT_OG_IMAGE,
  updatedAt = SEO_UPDATED_AT,
}: PageJsonLdOptions): JsonLd {
  const url = absoluteUrl(path);

  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: title,
    description,
    inLanguage: "en-GB",
    isPartOf: {
      "@id": `${SITE_URL}/#website`,
    },
    about: {
      "@id": `${SITE_URL}/#organization`,
    },
    primaryImageOfPage: {
      "@type": "ImageObject",
      url: absoluteUrl(image),
      width: OG_IMAGE_WIDTH,
      height: OG_IMAGE_HEIGHT,
    },
    dateModified: updatedAt,
  };
}

export function breadcrumbJsonLd(items: BreadcrumbItem[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function pageJsonLd(options: PageJsonLdOptions): JsonLd[] {
  const items = [webPageJsonLd(options)];

  if (options.breadcrumbs?.length) {
    items.push(breadcrumbJsonLd(options.breadcrumbs));
  }

  return items;
}

export function itemListJsonLd({
  id,
  name,
  description,
  items,
}: {
  id: string;
  name: string;
  description?: string;
  items: ItemListEntry[];
}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": absoluteUrl(id),
    name,
    description,
    numberOfItems: items.length,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: absoluteUrl(item.url),
      item: {
        "@type": item.type ?? "WebPage",
        "@id": item.id ? absoluteUrl(item.id) : undefined,
        name: item.name,
        url: absoluteUrl(item.url),
        description: item.description,
        image: item.image ? absoluteUrl(item.image) : undefined,
      },
    })),
  };
}

export function personJsonLd({
  id,
  name,
  description,
  image,
  jobTitle,
  sameAs,
  url,
  worksFor = SITE_NAME,
}: PersonJsonLdOptions): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": absoluteUrl(id),
    name,
    description,
    image: image ? absoluteUrl(image) : undefined,
    jobTitle,
    sameAs,
    url: url ? absoluteUrl(url) : absoluteUrl(id),
    worksFor: {
      "@id": `${SITE_URL}/#organization`,
      name: worksFor,
    },
    affiliation: {
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
    },
  };
}

export function teamProfileJsonLd({
  name,
  description,
  path,
  category,
  members,
  productUrl,
}: TeamProfileJsonLdOptions): JsonLd[] {
  const url = absoluteUrl(path);
  const teamId = `${url}#team`;
  const team: JsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": teamId,
    name,
    url,
    description,
    parentOrganization: {
      "@id": `${SITE_URL}/#organization`,
    },
    knowsAbout: category,
    member: members.map((member) => ({
      "@type": "Person",
      name: member.name,
      jobTitle: member.role,
      affiliation: {
        "@id": teamId,
      },
    })),
  };

  if (!productUrl) return [team];

  return [
    team,
    {
      "@context": "https://schema.org",
      "@type": "CreativeWork",
      "@id": `${url}#prototype`,
      name,
      url: absoluteUrl(productUrl),
      description,
      creator: {
        "@id": teamId,
      },
      isPartOf: {
        "@id": `${SITE_URL}/batches/spring-2026/#webpage`,
      },
      about: category,
    },
  ];
}

export function springBatchPartnerJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${GOOGLE_DEEPMIND_URL}#organization`,
    name: "Google DeepMind",
    url: GOOGLE_DEEPMIND_URL,
  };
}
