import { useFamily } from "../lib/family";
import { TRADITION_LABEL, fits } from "../lib/library";
import { learnerOf } from "../lib/store";
import type { Story } from "../lib/content/types";
import type { Mode } from "./Home";

export function LibraryScreen({ onStart, onBack }: { onStart: (s: Story, mode: Mode) => void; onBack: () => void }) {
  const { activeKid: kid, stories, progress } = useFamily();
  if (!kid) return null;
  const L = learnerOf(kid);
  const groups: Story["tradition"][] = ["family", "aesop", "panchatantra", "classic"];
  return (
    <main className="library">
      <div className="row"><button className="linkbtn" onClick={onBack}>← Back</button><div className="kicker">{kid.name}'s bookshelf</div></div>
      {groups.map((g) => {
        const list = stories.filter((s) => s.tradition === g);
        if (!list.length) return null;
        return (
          <section key={g}>
            <h3>{TRADITION_LABEL[g]}</h3>
            <div className="books">
              {list.map((s) => {
                const ok = kid.role === "listener" || fits(s, L); const p = progress[s.slug];
                return (
                  <button key={s.slug} className={"bk" + (p ? " done" : "") + (ok ? "" : " locked")} disabled={!ok} onClick={() => onStart(s, "listen")}>
                    <span className="ico">{s.pages[0].art}</span>
                    <b>{s.title}</b>
                    <small>{p ? `read ${p.timesFinished}× · ${p.results.filter((r) => r.ok).length}/${p.results.length} magic words` : ok ? "new" : "needs more sounds"}</small>
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
