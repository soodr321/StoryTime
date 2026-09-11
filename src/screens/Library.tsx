import { useState } from "react";
import { useFamily } from "../lib/family";
import { TRADITION_LABEL, fits } from "../lib/library";
import { learnerOf } from "../lib/store";
import type { Story } from "../lib/content/types";
import { Art } from "../components/Art";
import type { Mode } from "./Home";

const p2 = (progress: Record<string, { timesFinished: number }>, slug: string) => (progress[slug] ? `read ${progress[slug].timesFinished}× · reading it again builds fluency` : "new");

export function LibraryScreen({ onStart, onBack }: { onStart: (s: Story, mode: Mode, resume: boolean) => void; onBack: () => void }) {
  const { activeKid: kid, stories, progress, session, setSession } = useFamily();
  const [confirm, setConfirm] = useState<Story | null>(null);
  const [picked, setPicked] = useState<Story | null>(null);   // which book was tapped; the grown-up then picks a mode
  if (!kid) return null;
  const L = learnerOf(kid);
  const groups: Story["tradition"][] = ["family", "aesop", "panchatantra", "classic"];
  const inFlight = session ? stories.find((s) => s.slug === session.slug) : null;

  const pick = (s: Story) => {
    if (session && session.slug === s.slug) return onStart(s, session.mode, true);   // same story: carry on
    if (session && inFlight) return setConfirm(s);                                    // another story is mid-way: ask
    setPicked(s);
  };

  return (
    <main className="library">
      <div className="row"><button className="linkbtn" onClick={onBack}>← Back</button><div className="kicker">{kid.name}'s bookshelf</div></div>
      {picked && (
        <div className="pc confirmbox">
          <p><b>{picked.title}</b> · {p2(progress, picked.slug)}</p>
          <div className="modes">
            <button className="mode" onClick={() => onStart(picked, "listen", false)}><span className="mi">🔊</span><b>Nani reads</b><small>karaoke; {kid.name} reads the magic words</small></button>
            {kid.role !== "listener" && <button className="mode" onClick={() => onStart(picked, "read", false)}><span className="mi">📖</span><b>I read</b><small>sound off; reread a favourite for fluency</small></button>}
          </div>
          <button className="linkbtn" onClick={() => setPicked(null)}>cancel</button>
        </div>
      )}
      {confirm && inFlight && (
        <div className="pc confirmbox">
          <p><b>{inFlight.title}</b> is on page {session!.page + 1}. Leave it and start <b>{confirm.title}</b>?</p>
          <div className="btns">
            <button className="no" onClick={() => setConfirm(null)}>Keep {inFlight.title}</button>
            <button className="yes" onClick={() => { setSession(null); onStart(confirm, "listen", false); }}>Start {confirm.title}</button>
          </div>
        </div>
      )}
      {groups.map((g) => {
        const list = stories.filter((s) => s.tradition === g);
        if (!list.length) return null;
        return (
          <section key={g}>
            <h3>{TRADITION_LABEL[g]}</h3>
            <div className="books">
              {list.map((s) => {
                const ok = kid.role === "listener" || fits(s, L); const p = progress[s.slug];
                const mid = session?.slug === s.slug;
                return (
                  <button key={s.slug} className={"bk" + (p ? " done" : "") + (ok || p ? "" : " locked") + (mid ? " mid" : "")} disabled={!ok && !p} onClick={() => pick(s)}>
                    <span className="ico"><Art art={s.pages[0].art} /></span>
                    <b>{s.title}</b>
                    <small>{mid ? `page ${session!.page + 1} · continue` : p ? `read ${p.timesFinished}× · ${p.results.filter((r) => r.ok).length}/${p.results.length} magic words` : ok ? "new" : "needs more sounds"}</small>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </main>
  );
}
