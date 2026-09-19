/**
 * A story's picture. Library books have a drawn banner (the stage above the story) and a cover
 * (the square on the shelf); four of the Aesop books use Milo Winter's 1919 plates as their cover.
 * Family stories keep their emoji or the photograph the family chose.
 */
import { COVER_ZOOM, PLATE_COVERS, STORY_ART } from "./art/Banners";
import { BASE } from "../lib/library";

export const coverUrl = (slug: string) => `${BASE}/covers/cover-${slug}.jpg`;

/** The wide picture above the story. */
export function Banner({ slug, art }: { slug?: string; art?: string }) {
  const Drawn = slug ? STORY_ART[slug] : undefined;
  if (Drawn) return <Drawn />;
  if (art?.startsWith("data:")) return <img className="art-img" src={art} alt="" />;
  return <span className="art-emoji">{art}</span>;
}

/** The square on the bookshelf, the home card and the end screen. */
export function Cover({ slug, art, className }: { slug?: string; art?: string; className?: string }) {
  if (slug && PLATE_COVERS.has(slug)) return <img className={className ?? "art-img"} src={coverUrl(slug)} alt="" />;
  const Drawn = slug ? STORY_ART[slug] : undefined;
  if (Drawn) return <span className={className ?? "art-img"}><Drawn view={COVER_ZOOM[slug!]} /></span>;
  if (art?.startsWith("data:")) return <img className={className ?? "art-img"} src={art} alt="" />;
  return <span className={className}>{art}</span>;
}

/** Kept for family stories and anywhere a plain emoji or photo is all there is. */
export function Art({ art, className }: { art: string; className?: string }) {
  if (art.startsWith("data:")) return <img className={className ?? "art-img"} src={art} alt="" />;
  return <span className={className}>{art}</span>;
}
