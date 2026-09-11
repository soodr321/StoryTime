import { useFamily } from "../lib/family";
import { TRADITION_LABEL, storyAsset } from "../lib/library";
import { useEffect } from "react";
import type { Story } from "../lib/content/types";
import { Art } from "../components/Art";
import { playClip } from "../lib/audio/player";
import { soundAsset } from "../lib/library";
import { GRAPHEME_SOUND, LS_PHASE2_ORDER } from "../lib/phonics/learner";

export type Mode = "listen" | "read";

const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();

/** Warm the audio cache for a story so it plays in the car / on the plane. Best effort. */
async function precache(story: Story) {
  if (story.tradition === "family") return;
  const files = [...story.pages.map((p) => p.audio), story.moral.audio, ...Object.values(story.prompts ?? {}).map((p) => p.audio)].filter(Boolean) as string[];
  await Promise.allSettled(files.map((f) => fetch(storyAsset(story, f), { cache: "force-cache" })));
}

function WeekStrip({ days }: { days: number[] }) {
  const today = new Date(); const cells = [] as { label: string; on: boolean; isToday: boolean }[];
  for (let i = 6; i >= 0; i--) { const d = new Date(today); d.setDate(today.getDate() - i); cells.push({ label: d.toLocaleDateString(undefined, { weekday: "narrow" }), on: days.some((t) => sameDay(t, d.getTime())), isToday: i === 0 }); }
  return <div className="week" aria-label="stories this week">{cells.map((c, i) => <span key={i} className={"day" + (c.on ? " on" : "") + (c.isToday ? " today" : "")}>{c.on ? "★" : c.label}</span>)}</div>;
}

export function HomeScreen({ onStart, onLibrary, onSwitch, onWarmUp }: { onStart: (story: Story, mode: Mode, resume: boolean) => void; onLibrary: () => void; onSwitch: () => void; onWarmUp: () => void }) {
  const { activeKid: kid, todayFor, repeatToday, session, stories, progress, settings, setSession, review } = useFamily();
  const resumable = session ? stories.find((s) => s.slug === session.slug) ?? null : null;
  const today = kid ? resumable ?? todayFor(kid) : null;
  useEffect(() => { if (today) void precache(today); }, [today]);
  if (!kid) return null;
  const finished = Object.keys(progress).length;
  const listener = kid.role === "listener";
  const lastFinished = Math.max(0, ...Object.values(progress).map((p) => p.lastFinished ?? 0));
  const doneTonight = settings.bedtime && lastFinished > 0 && sameDay(lastFinished, Date.now()) && !resumable;
  const days = Object.values(progress).flatMap((p) => p.history ?? (p.lastFinished ? [p.lastFinished] : []));

  return (
    <main className="home-screen">
      <button className="who" onClick={onSwitch}><span>{kid.avatar}</span> {kid.name} · <u>switch</u></button>
      <WeekStrip days={days} />
      {!listener && kid.gpcs.length < LS_PHASE2_ORDER.length && (
        <div className="nextsound"><span className="legend">Next sound to teach:</span> <button className="soundbtn" onClick={() => void playClip(soundAsset(GRAPHEME_SOUND[LS_PHASE2_ORDER[kid.gpcs.length]].clip)).done.catch(() => {})}>{LS_PHASE2_ORDER[kid.gpcs.length]} 🔊</button> <span className="legend">the sound, not the letter name · tick it in ⚙︎ once taught</span></div>
      )}

      {doneTonight ? (
        <div className="closing">
          <div className="art-box big"><span>🌙</span></div>
          <h2>Story done for tonight.</h2>
          <p className="note">One real book, then sleep. StoryTime opens again tomorrow.</p>
          <button className="linkbtn" onClick={() => today && onStart(today, "listen", false)}>grown-up: read one more anyway</button>
        </div>
      ) : today ? (
        <>
          <div className="kicker">{resumable ? "Carry on where you stopped" : repeatToday ? "Same story — smoother today" : finished ? "Today's story" : "Your first story"}</div>
          <div className="big-tile" role="group" aria-label={today.title}>
            <span className="art"><Art art={today.pages[0].art} /></span>
            <span className="t">{today.title}</span>
            <span className="s">{TRADITION_LABEL[today.tradition]} · {today.pages.filter((p) => p.magic?.length).length} magic words{resumable ? ` · page ${session!.page + 1}` : ""}</span>
          </div>
          {resumable ? (
            <div className="modes">
              <button className="mode" onClick={() => onStart(today, session!.mode, true)}>
                <span className="mi">{session!.mode === "listen" ? "🔊" : "📖"}</span><b>Continue</b><small>{session!.mode === "listen" ? "Nani reads" : "I read"} · page {session!.page + 1}</small>
              </button>
              <button className="mode quiet" onClick={() => setSession(null)}>
                <span className="mi">↺</span><b>Start over</b><small>Pick a mode again</small>
              </button>
            </div>
          ) : review.length > 0 && !listener ? (
            <button className="warmcard" onClick={onWarmUp}><b>Warm-up first</b><span>{review.map((r) => r.word).join(" · ")}</span><small>1 minute · words from last time, then the story</small></button>
          ) : (
            <div className="modes">
              <button className="mode" onClick={() => onStart(today, "listen", false)}>
                <span className="mi">🔊</span><b>{settings.bedtime ? "Bedtime story" : "Nani reads"}</b>
                <small>{listener ? "Listen and tap the words you like." : "Karaoke story. You read the magic words."}</small>
              </button>
              {!listener && (
                <button className="mode" onClick={() => onStart(today, "read", false)}>
                  <span className="mi">📖</span><b>I read</b><small>Sound off. A grown-up reads with you.</small>
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="note">No story fits {kid.name}'s sounds yet. A grown-up can add sounds in Settings.</p>
      )}
      <button className="linkbtn" onClick={onLibrary}>📚 Bookshelf · {finished} finished</button>
    </main>
  );
}
