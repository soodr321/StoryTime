#!/bin/zsh
# Concatenate the app source for a pasted-source review prompt.
cd "$(dirname "$0")/.."
for f in src/App.tsx src/lib/family.tsx src/lib/store.ts src/lib/library.ts src/lib/audio/player.ts src/lib/audio/speech.ts src/lib/audio/record.ts src/lib/phonics/validator.ts src/lib/phonics/learner.ts src/lib/content/types.ts src/machine/story.machine.ts src/screens/Welcome.tsx src/screens/Family.tsx src/screens/Home.tsx src/screens/Story.tsx src/screens/Library.tsx src/screens/Settings.tsx src/screens/AddStory.tsx src/components/Art.tsx src/index.css; do echo; echo "----- $f -----"; cat "$f"; done
echo; echo "----- library/fox-and-crow/story.json (one of 7; tokens collapsed) -----"
python3 -c "import json;d=json.load(open('library/fox-and-crow/story.json'));[p.update({'tokens':' '.join(t['t'] for t in p['tokens'])}) for p in d['pages']];d.pop('prompts',None);print(json.dumps(d,ensure_ascii=False,indent=1))"
echo; echo "----- library titles -----"; ls library
