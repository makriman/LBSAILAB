import type { CollectionEntry } from "astro:content";

export type TeamEntry = CollectionEntry<"teams">;
export type BatchEntry = CollectionEntry<"batches">;
export type PersonEntry = CollectionEntry<"people">;
export type MentorEntry = CollectionEntry<"mentors">;

export function sortTeamsByBatchList(teams: TeamEntry[], teamIds: string[]) {
  const order = new Map(teamIds.map((id, index) => [id, index]));

  return [...teams].sort((a, b) => {
    const aOrder = order.get(a.data.id) ?? Number.MAX_SAFE_INTEGER;
    const bOrder = order.get(b.data.id) ?? Number.MAX_SAFE_INTEGER;
    return (
      aOrder - bOrder || a.data.displayName.localeCompare(b.data.displayName)
    );
  });
}

export function teamMemberLabel(count: number) {
  return `${count} ${count === 1 ? "builder" : "builders"}`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
