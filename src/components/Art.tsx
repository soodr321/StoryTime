/** An illustration: an emoji, or a family photo stored as a data URL. */
export function Art({ art, className }: { art: string; className?: string }) {
  if (art.startsWith("data:")) return <img className={className ?? "art-img"} src={art} alt="" />;
  return <span className={className}>{art}</span>;
}
