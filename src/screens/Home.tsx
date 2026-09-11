import { useFamily } from "../lib/family";
import { TRADITION_LABEL } from "../lib/library";
import type { Story } from "../lib/content/types";

export type Mode = "listen" | "read";

export function HomeScreen({ onStart, onLibrary, onSwitch }: { onStart: (story: Story, mode: Mode, resume: boolean) => void; onLibrary: () => void; onSwitch: () => void }) {
  const { activeKid: kid, todayFor, session, stories, progress, settings } = useFamily();
  if (!kid) return null;
  const resumable = session && session.kidId === kid.id ? stories.find((s) => s.slug === session.slug) : null;
  const today = resumable ?? todayFor(kid);
  const finished = Object.keys(progress).length;
  const listener = kid.role === "listener";
  return (
    <main className="home-screen">
      <button className="who" onClick={onSwitch}><span>{kid.avatar}</span> {kid.name} · <u>switch</u></button>
      {today ? (
        <>
          <div className="kicker">{resumable ? "Carry on where you stopped" : finished ? "Today's story" : "Your first story"}</div>
          <div className="big-tile" role="group" aria-label={today.title}>
            <span className="art">{today.pages[0].art}</span>
            <span className="t">{today.title}</span>
            <span className="s">{TRADITION_LABEL[today.tradition]} · {today.pages.filter((p) => p.magic?.length).length} magic words{resumable ? ` · page ${resumable ? session!.page + 1 : 1}` : ""}</span>
          </div>
          <div className="modes">
            <button className="mode" onClick={() => onStart(today, "listen", !!resumable)}>
              <span className="mi">🔊</span><b>{settings.bedtime ? "Bedtime story" : "Nani reads"}</b>
              <small>{listener ? "Listen and tap the words you like." : "Karaoke story. You read the magic words."}</small>
            </button>
            {!listener && (
              <button className="mode" onClick={() => onStart(today, "read", !!resumable)}>
                <span className="mi">📖</span><b>I read</b><small>Sound off. A grown-up reads with you.</small>
              </button>
            )}
          </div>
        </>
      ) : (
        <p className="note">No story fits {kid.name}'s sounds yet. A grown-up can add sounds in Settings.</p>
      )}
      <button className="linkbtn" onClick={onLibrary}>📚 Bookshelf · {finished} finished</button>
    </main>
  );
}
