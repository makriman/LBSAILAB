/**
 * Single pin for the public last-updated date.
 *
 * Pages, the sitemap, the Worker `Last-Modified` header, `public/_headers`,
 * and the SEO audits all read this module. Change the date here only.
 * `public/.well-known/security.txt` `Expires` is a separate field.
 */
export const SITE_UPDATED_ON = "2026-06-16";
export const SITE_UPDATED_AT_ISO = `${SITE_UPDATED_ON}T00:00:00.000Z`;
export const SITE_LAST_MODIFIED = new Date(SITE_UPDATED_AT_ISO).toUTCString();
