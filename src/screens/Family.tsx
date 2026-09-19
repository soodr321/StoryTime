import { useEffect, useState } from "react";
import { useFamily } from "../lib/family";
import { dayStamp } from "../lib/day";
import { loadProgress } from "../lib/store";
import { StarIcon } from "../components/Icons";

const SunIcon = () => <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="12" cy="12" r="4" fill="var(--star)" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" /></svg>;

/** Who is reading today? One tap per child; grown-ups go to Settings. */
export function FamilyScreen({ onPick, onSettings }: { onPick: (id: string) => void; onSettings: () => void }) {
  const { kids, sessions, settings } = useFamily();
  const tonight = settings.tonight ?? settings.readers[0];
  const [nights, setNights] = useState<Record<string, number>>({});
  useEffect(() => {   // distinct reading days per child, for the stars; best effort
    let live = true;
    void Promise.all(kids.map(async (k) => { try { const p = await loadProgress(k.id); const days = new Set([...Object.values(p).flatMap((x) => x.history ?? []), ...(k.teachDays ?? [])].map((t) => dayStamp(typeof t === "string" ? new Date(t) : t))); return [k.id, days.size + (days.has(dayStamp()) ? 0 : 1)] as const; } catch { return [k.id, 0] as const; } }))
      .then((rows) => { if (live) setNights(Object.fromEntries(rows)); });
    return () => { live = false; };
  }, [kids]);
  const nightsFor = (id: string) => nights[id] ?? 0;
  return (
    <main className="family">
      <div className="kicker rise">Who is reading tonight?</div>
      <div className="kidgrid rise2">
        {kids.map((k) => (
          <button key={k.id} className={"kid" + (sessions[k.id] ? " has-session" : "") + (k.role === "reader" ? " reader" : "")} onClick={() => onPick(k.id)}>
            <span className="av">{k.avatar}</span>
            <b>{k.name}</b>
            <small>{k.role === "listener" ? "listens & taps" : `${k.gpcs.length} sounds · night ${Math.min(30, nightsFor(k.id))}`}</small>
            <span className="stars" aria-hidden>{k.role === "reader" && Array.from({ length: 5 }, (_, i) => <StarIcon key={i} filled={i < Math.min(5, nightsFor(k.id))} />)}</span>
            {sessions[k.id] && <em>story in progress</em>}
          </button>
        ))}
      </div>
      {tonight && <div className="tonight rise3"><span className="sun"><SunIcon /></span><span><b>{tonight}</b> is reading tonight.<br /><span className="legend">Tap a name, then one story.</span></span></div>}
      <button className="linkbtn" onClick={onSettings}>Grown-ups: settings, stories, sounds →</button>
    </main>
  );
}
