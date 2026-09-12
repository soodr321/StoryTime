# The family's voice

Raw recordings, one per sound, exactly as they were spoken. These are the pinned originals: every
shipped clip in `public/sounds/` is derived from them by `scripts/import-voice-pack.py`, which trims,
level-matches and then runs the same gates as the stock set (one voice, steady vowels, voice onset
for stops, no letter names). Improve the processing later and re-run the import — nobody records again.

**To record:** `npm run dev`, open the address it prints on the phone (same wifi) or the Mac, then
Settings → "Record the sounds". Each take you keep is written here automatically.

**To ship them:** `npm run voice:import`, then deploy. Every device gets this voice, offline, with no
account and nothing leaving the phone.

**To change one sound later:** re-record just that one, run the import again, deploy.
