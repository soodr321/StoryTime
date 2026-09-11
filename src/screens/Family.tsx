import { useFamily } from "../lib/family";

/** Who is reading today? One tap per child; grown-ups go to Settings. */
export function FamilyScreen({ onPick, onSettings }: { onPick: (id: string) => void; onSettings: () => void }) {
  const { kids, sessions } = useFamily();
  return (
    <main className="family">
      <div className="kicker">Who is reading today?</div>
      <div className="kidgrid">
        {kids.map((k) => (
          <button key={k.id} className={"kid" + (sessions[k.id] ? " has-session" : "")} onClick={() => onPick(k.id)}>
            <span className="av">{k.avatar}</span>
            <b>{k.name}</b>
            <small>{k.role === "listener" ? "listens & taps" : `${k.gpcs.length} sounds`}</small>
            {sessions[k.id] && <em>story in progress</em>}
          </button>
        ))}
      </div>
      <button className="linkbtn" onClick={onSettings}>Grown-ups: settings, stories, sounds →</button>
    </main>
  );
}
