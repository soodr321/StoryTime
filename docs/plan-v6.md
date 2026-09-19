# Plan v6 — while we wait on permission (2026-09-18)

Permission to use the Sound City Reading alphabet sounds was requested by email on 2026-09-18.
Nothing in this plan waits on the answer.

## 1. The letter sounds become a swap, not a rewrite  · done
A pack is a folder of raw recordings plus a licence. `scripts/sound-packs.json` lists them,
`npm run sounds:build <pack>` rebuilds the shipped eighteen from any of them through the same
trimming, level-matching and phonetic gates, and stamps `public/sounds/manifest.json` with which
pack shipped and under what terms. The app credits that pack on the Sounds screen, so the credit
can never drift from the audio. A pack marked non-redistributable builds locally and is refused by
both deploy scripts, which is what keeps Kathryn Davis's files off a public URL unless she says yes.

Switching later: drop the recordings in, `npm run sounds:build soundcity`, deploy. If the answer is
no, `npm run sounds:build commons` or `family` and nothing else changes.

## 2. The set-3 hole  · next
The library is two set-1 books, one set-2, seven set-4, and nothing at set 3. A child who has just
learned g, o, c and k has no book at their level: they re-read set-1 books or wait. Two set-3
stories and one more set-2, written against the validator, narrated and blended like the rest.

## 3. Illustrations that are not emoji
Ten stories currently open on an emoji. The mascots proved the house style works: flat shapes, one
stroke weight, the app's own palette. One drawing per story, then one per page if they earn it.
This is the piece that most changes how the app feels to a four-year-old, and the piece I would
most like a look at before it is spread across ten books.

## 4. Still only the owner can do these
Three nights of real use; a slow phone; a screen at 2% brightness; a child hammering the tiles.
