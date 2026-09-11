/**
 * Tiny teach-a-new-sound routine data: pure sound (real recording), a mouth cue for the grown-up,
 * an action, three spoken words that start with the sound, the grapheme to trace, and one
 * familiar word to blend. Letters & Sounds phase 2 order.
 */
export interface Teach { g: string; mouth: string; action: string; words: string[]; blend: string[]; position?: "start" | "end" }

export const TEACH: Record<string, Teach> = {
  s:  { g: "s",  mouth: "Teeth nearly together, tongue behind them, a long hiss.", action: "Weave your hand like a snake.", words: ["sun", "sock", "sip"], blend: [] },
  a:  { g: "a",  mouth: "Mouth open wide, short and quick: a, as in apple.", action: "Pretend to bite an apple.", words: ["apple", "ant", "as"], blend: [] },
  t:  { g: "t",  mouth: "Tongue tip taps behind the top teeth. Quick, no 'uh' after it.", action: "Tap one finger on the table.", words: ["tap", "top", "tin"], blend: ["s", "a", "t"] },
  p:  { g: "p",  mouth: "Lips together, a puff of air. Keep it quiet: p, not 'puh'.", action: "Puff a candle out.", words: ["pat", "pin", "pot"], blend: ["t", "a", "p"] },
  i:  { g: "i",  mouth: "Short and quick: i, as in ink.", action: "Wriggle your fingers like an itchy mouse.", words: ["ink", "in", "it"], blend: ["s", "i", "t"] },
  n:  { g: "n",  mouth: "Tongue up behind the top teeth, hum through the nose: nnn.", action: "Sound like a plane: nnnnn.", words: ["net", "nap", "nod"], blend: ["p", "i", "n"] },
  m:  { g: "m",  mouth: "Lips closed, hum: mmm.", action: "Rub your tummy: mmm, yummy.", words: ["mat", "mum", "man"], blend: ["m", "a", "p"] },
  d:  { g: "d",  mouth: "Like t, but with your voice on. Quick: d, not 'duh'.", action: "Beat a drum.", words: ["dog", "dad", "dip"], blend: ["d", "i", "d"] },
  g:  { g: "g",  mouth: "Back of the tongue up, voice on, quick: g.", action: "Gulp a drink: g, g, g.", words: ["get", "gap", "gum"], blend: ["d", "i", "g"] },
  o:  { g: "o",  mouth: "Round lips, short: o, as in on.", action: "Turn a tap on and off.", words: ["on", "off", "ox"], blend: ["g", "o", "t"] },
  c:  { g: "c",  mouth: "Back of the tongue, a quiet click of air: c (the same sound as k).", action: "Click castanets with your fingers.", words: ["cat", "cup", "cot"], blend: ["c", "a", "t"] },
  k:  { g: "k",  mouth: "Same sound as c: a quiet click at the back.", action: "Kick a ball.", words: ["kit", "kid", "kick"], blend: ["k", "i", "d"] },
  ck: { g: "ck", mouth: "Two letters, ONE sound: k. It comes at the end of short words.", action: "Kick again: ck.", words: ["duck", "sock", "kick"], blend: ["s", "o", "ck"], position: "end" },
  e:  { g: "e",  mouth: "Mouth a little open, short: e, as in egg.", action: "Crack an egg.", words: ["egg", "end", "elf"], blend: ["p", "e", "n"] },
  u:  { g: "u",  mouth: "Short and low: u, as in up.", action: "Put up an umbrella.", words: ["up", "us", "under"], blend: ["c", "u", "p"] },
  r:  { g: "r",  mouth: "Lips a little forward, voice on, growl softly: rrr.", action: "Be a puppy: rrr.", words: ["run", "rat", "red"], blend: ["r", "u", "n"] },
  h:  { g: "h",  mouth: "Just breath: h, like fogging a mirror.", action: "Pant like a hot dog.", words: ["hat", "hop", "hen"], blend: ["h", "o", "t"] },
  b:  { g: "b",  mouth: "Lips together, voice on, quick: b, not 'buh'.", action: "Bounce a ball.", words: ["bat", "bed", "bin"], blend: ["b", "e", "d"] },
  f:  { g: "f",  mouth: "Top teeth on the bottom lip, blow: fff.", action: "Let air out of a balloon: fff.", words: ["fan", "fin", "fog"], blend: ["f", "a", "n"] },
  ff: { g: "ff", mouth: "Two letters, one sound: fff.", action: "Same balloon: fff.", words: ["off", "puff", "huff"], blend: ["o", "ff"], position: "end" },
  l:  { g: "l",  mouth: "Tongue tip up behind the top teeth, voice on: lll.", action: "Lick a lolly.", words: ["leg", "lid", "lap"], blend: ["l", "e", "g"] },
  ll: { g: "ll", mouth: "Two letters, one sound: lll.", action: "Lick the lolly again.", words: ["bell", "doll", "hill"], blend: ["d", "o", "ll"], position: "end" },
  ss: { g: "ss", mouth: "Two letters, one sound: sss.", action: "Snake again: sss.", words: ["hiss", "kiss", "mess"], blend: ["m", "e", "ss"], position: "end" },
};
