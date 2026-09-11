import { useState } from "react";
import { FamilyProvider, useFamily } from "./lib/family";
import type { Story } from "./lib/content/types";
import { unlock } from "./lib/audio/player";
import { FamilyScreen } from "./screens/Family";
import { HomeScreen, type Mode } from "./screens/Home";
import { LibraryScreen } from "./screens/Library";
import { SettingsScreen } from "./screens/Settings";
import { StoryScreen } from "./screens/Story";
import { AddStoryScreen } from "./screens/AddStory";
import { WelcomeScreen } from "./screens/Welcome";
import { WarmUpScreen } from "./screens/WarmUp";
import { TeachSoundScreen } from "./screens/TeachSound";

type Route = { name: "family" } | { name: "home" } | { name: "warmup" } | { name: "teach" } | { name: "library" } | { name: "settings" } | { name: "add" } | { name: "story"; story: Story; mode: Mode; resume: boolean };

export default function App() {
  return <FamilyProvider><Shell /></FamilyProvider>;
}

function Shell() {
  const fam = useFamily();
  const [route, setRoute] = useState<Route>({ name: "home" });
  if (!fam.ready) return <div className="app"><main className="home-screen"><p className="note">Opening StoryTime…</p></main></div>;
  if (fam.fatal) return <div className="app"><main className="home-screen"><h2>Storage needs a hand</h2><p className="note">This phone would not open StoryTime's saved data ({fam.fatal}). Private browsing or a full phone can cause this. You can still read a story now; progress will not be kept until it is fixed.</p><div className="btns"><button className="yes" onClick={() => location.reload()}>Try again</button><button className="no" onClick={async () => { try { indexedDB.deleteDatabase("keyval-store"); } catch { /* ignore */ } location.reload(); }}>Reset saved data</button></div></main></div>;

  const start = (story: Story, mode: Mode, resume = false) => { void unlock(); setRoute({ name: "story", story, mode, resume }); };
  const dim = fam.settings.bedtime ? " bedtime" : "";

  if (!fam.settings.onboarded) return <div className="app"><WelcomeScreen onDone={() => setRoute({ name: "home" })} />{fam.toast && <div className="toast" role="status">{fam.toast}</div>}</div>;
  if (route.name === "story") return <div className={"app" + dim}><StoryScreen key={route.story.slug + route.mode} story={route.story} mode={route.mode} resume={route.resume} onHome={() => setRoute({ name: "home" })} /></div>;

  return (
    <div className={"app" + dim}>
      <header className="top">
        <button className="home" onClick={() => setRoute({ name: "family" })} aria-label="Family">👨‍👩‍👧‍👦</button>
        <div className="title">StoryTime</div>
        <button className="home" onClick={() => setRoute({ name: "settings" })} aria-label="Settings">⚙︎</button>
      </header>
      {route.name === "family" && <FamilyScreen onPick={(id) => { fam.setActiveKid(id); setRoute({ name: "home" }); }} onSettings={() => setRoute({ name: "settings" })} />}
      {route.name === "home" && <HomeScreen onStart={start} onLibrary={() => setRoute({ name: "library" })} onSwitch={() => setRoute({ name: "family" })} onWarmUp={() => { void unlock(); setRoute({ name: "warmup" }); }} onTeach={() => { void unlock(); setRoute({ name: "teach" }); }} />}
      {route.name === "teach" && <TeachSoundScreen onDone={() => setRoute({ name: "home" })} />}
      {route.name === "warmup" && <WarmUpScreen onDone={() => setRoute({ name: "home" })} />}
      {route.name === "library" && <LibraryScreen onStart={(s, m, r) => start(s, m, r)} onBack={() => setRoute({ name: "home" })} />}
      {fam.toast && <div className="toast" role="status">{fam.toast}</div>}
      {route.name === "settings" && <SettingsScreen onBack={() => setRoute({ name: "family" })} onAddStory={() => setRoute({ name: "add" })} />}
      {route.name === "add" && <AddStoryScreen onDone={() => setRoute({ name: "settings" })} />}
    </div>
  );
}
