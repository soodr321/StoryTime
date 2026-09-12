import { useFamily } from "../lib/family";
import { TRADITION_LABEL, storyAsset } from "../lib/library";
import { useEffect } from "react";
import type { Story } from "../lib/content/types";
import { Art } from "../components/Art";
import { playSound } from "../lib/sounds";
import { GRAPHEME_SOUND, LS_PHASE2_ORDER } from "../lib/phonics/learner";
import { BookIcon, MoonIcon, RedoIcon, SpeakerIcon, StarIcon } from "../components/Icons";

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
  return <div className="week" aria-label="stories this week">{cells.map((c, i) => <span key={i} className={"day" + (c.on ? " on" : "") + (c.isToday ? " today" : "")}>{c.on ? <StarIcon size={16} /> : c.label}</span>)}</div>;
}

export function HomeScreen({ onStart, onLibrary, onSwitch, onWarmUp, onTeach }: { onStart: (story: Story, mode: Mode, resume: boolean) => void; onLibrary: () => void; onSwitch: () => void; onWarmUp: () => void; onTeach: (replay?: boolean) => void }) {
  const { activeKid: kid, todayFor, repeatToday, session, stories, progress, settings, setSession, review, advanceReady, nights, storiesFor, listensAlong } = useFamily();
  const resumable = session ? stories.find((s) => s.slug === session.slug) ?? null : null;
  const today = kid ? resumable ?? todayFor(kid) : null;
  useEffect(() => { if (today) void precache(today); }, [today]);
  if (!kid) return null;
  const finished = Object.values(progress).filter((p) => p.timesFinished > 0).length;
  const listenAlong = listensAlong(kid);
  const taughtToday = (kid.teachDays ?? []).some((d) => new Date(d).toDateString() === new Date().toDateString());   // fewer than four sounds: tonight is a listen-along, not a reading
  const listener = kid.role === "listener";
  const lastFinished = Math.max(0, ...Object.values(progress).map((p) => p.lastFinished ?? 0));
  const doneTonight = settings.bedtime && lastFinished > 0 && sameDay(lastFinished, Date.now()) && !resumable;
  const days = Object.values(progress).flatMap((p) => p.history ?? (p.lastFinished ? [p.lastFinished] : []));

  return (
    <main className="home-screen">
      <button className="who" onClick={onSwitch}><span>{kid.avatar}</span> {kid.name} · <u>switch</u></button>
      <div className="row between" style={{ width: "min(100%, 420px)" }}><WeekStrip days={days} /><span className="nights">night <b>{Math.min(30, nights + 1)}</b> of 30</span></div>
      {!listener && nights >= 30 && <div className="champion"><span>🏅</span><b>30 nights of reading!</b><small>{kid.name} is a Reading Champion. Keep the ritual: one story, then a real book.</small></div>}
      {!listener && kid.gpcs.length < 4 && (
        <button className="readycard" onClick={() => onTeach(taughtToday)}><b>{taughtToday ? `Replay today's sound: ${kid.gpcs[kid.gpcs.length - 1]}` : `Teach today's sound: ${LS_PHASE2_ORDER[kid.gpcs.length]}`}</b><small>90 seconds, one new sound a day. After four sounds {kid.name} starts reading the magic words.</small></button>
      )}
      {!listener && advanceReady && kid.gpcs.length >= 4 && kid.gpcs.length < LS_PHASE2_ORDER.length && (
        <button className="readycard" onClick={() => onTeach(false)}><b>Ready for the next sound-spelling: {LS_PHASE2_ORDER[kid.gpcs.length]}</b><small>Two smooth sessions and a word built. 90 seconds to teach it — you decide when.</small></button>
      )}
      {!listener && advanceReady && kid.gpcs.length < LS_PHASE2_ORDER.length && (
        <div className="nextsound"><span className="legend">Next sound:</span> <button className="soundbtn" onClick={() => void playSound(GRAPHEME_SOUND[LS_PHASE2_ORDER[kid.gpcs.length]].clip)}>{LS_PHASE2_ORDER[kid.gpcs.length]}</button> <button className="linkbtn" onClick={() => onTeach(false)}>teach it · 90 s →</button></div>
      )}

      {doneTonight ? (
        <div className="closing">
          <div className="art-box big"><MoonIcon size={72} /></div>
          <h2>Story done for tonight.</h2>
          <p className="note">One real book, then sleep. StoryTime opens again tomorrow.</p>
          <button className="linkbtn" onClick={() => today && onStart(today, "listen", false)}>grown-up: read one more anyway</button>
        </div>
      ) : today ? (
        <>
          <div className="kicker">{resumable ? "Carry on where you stopped" : listenAlong ? "Tonight's story" : repeatToday ? "Same story — smoother today" : finished ? "Today's story" : "Your first story"}</div>
          <button className="big-tile rise" aria-label={`Start ${today.title}`} onClick={() => (review.length > 0 && !listener ? onWarmUp() : onStart(today, resumable ? session!.mode : "listen", !!resumable))}>
            <span className="art rise"><Art art={today.pages[0].art} /></span>
            <span className="t">{today.title}</span>
            <span className="s">{listenAlong ? `${TRADITION_LABEL[today.tradition]} · a story to listen to` : `${TRADITION_LABEL[today.tradition]} · ${today.pages.reduce((n, p) => n + (p.magic?.length ?? 0), 0)} magic words${resumable ? ` · page ${session!.page + 1}` : ""}`}</span>
          </button>
          {resumable ? (
            <div className="modes">
              <button className="mode" onClick={() => onStart(today, session!.mode, true)}>
                <span className="mi">{session!.mode === "listen" ? <SpeakerIcon /> : <BookIcon />}</span><b>Continue</b><small>{session!.mode === "listen" ? "Nani reads" : "I read"} · page {session!.page + 1}</small>
              </button>
              <button className="mode quiet" onClick={() => setSession(null)}>
                <span className="mi"><RedoIcon /></span><b>Start over</b><small>Pick a mode again</small>
              </button>
            </div>
          ) : review.length > 0 && !listener ? (
            <button className="warmcard" onClick={onWarmUp}><b>Warm-up first</b><span>{review.map((r) => r.word).join(" · ")}</span><small>1 minute · words from last time, then the story</small></button>
          ) : listenAlong ? (
            <div className="modes rise2">
              <button className="mode" onClick={() => onStart(today, "listen", false)}>
                <span className="mi">{settings.bedtime ? <MoonIcon /> : <SpeakerIcon />}</span><b>{settings.tonight ?? "Nani"} reads it all</b>
                <small>Tonight {kid.name} listens, points and taps the words. {4 - kid.gpcs.length === 0 ? "Magic words start tomorrow." : `${kid.name}'s first magic word comes in ${4 - kid.gpcs.length} sleep${4 - kid.gpcs.length > 1 ? "s" : ""}.`}</small>
              </button>
            </div>
          ) : (
            <div className="modes rise2">
              <button className="mode" onClick={() => onStart(today, "listen", false)}>
                <span className="mi">{settings.bedtime ? <MoonIcon /> : <SpeakerIcon />}</span><b>{settings.bedtime ? "Bedtime story" : "Nani reads"}</b>
                <small>{listener ? "Listen and tap the words you like." : "Karaoke story. You read the magic words."}</small>
              </button>
              {!listener && (
                <button className="mode" onClick={() => onStart(today, "read", false)}>
                  <span className="mi"><BookIcon /></span><b>I read</b><small>Sound off. A grown-up reads with you.</small>
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="note">No story fits {kid.name}'s sounds yet. A grown-up can add sounds in Settings.</p>
      )}
      {today && !resumable && !doneTonight && !repeatToday && review.length === 0 && (() => { const alt = storiesFor(kid).find((s) => s.slug !== today.slug && !progress[s.slug]) ?? storiesFor(kid).find((s) => s.slug !== today.slug); return alt ? <button className="linkbtn" onClick={() => onStart(alt, "listen", false)}>or {kid.name} picks: {alt.pages[0].art} {alt.title} →</button> : null; })()}
      <button className="linkbtn" onClick={review.length > 0 && !listener ? onWarmUp : onLibrary}><BookIcon size={18} /> Bookshelf · {finished} finished{review.length > 0 && !listener ? " · after the warm-up" : ""}</button>
    </main>
  );
}
