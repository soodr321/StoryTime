/**
 * The picture above a story: a stage, not a picture of the word.
 *
 * Every banner is a sky band, a ground band and one prop on the horizon. No faces, no figures, and
 * never the decodable noun of the page — a 4-year-old who has just seen a crow holding cheese will
 * guess "cheese" instead of reading it, veil or no veil. Keeping the people off the stage also keeps
 * the drawing inside what flat vector does well.
 *
 * Built for three frames: 350x250 above the story, 350x100 while a word is open (so the horizon sits
 * mid-frame and survives the crop), and dimmed to half brightness at bedtime (so the palette is
 * quiet and the shapes are large).
 */
const INK = "#2b2418";
const L = { fill: "none", stroke: INK, strokeWidth: 3, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** sky above, ground below, horizon dead centre so the squashed strip still reads */
function Stage({ sky = "#efe0c4", ground = "#cfe0c0", far = "#bcd3ab", view, children }: { sky?: string; ground?: string; far?: string; view?: string; children?: React.ReactNode }) {
  return (
    <svg viewBox={view ?? "0 0 350 250"} className="ill" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect x="-40" y="-40" width="430" height="330" fill={sky} />
      <path d="M0 132 C60 120 130 126 196 134 C252 141 310 136 350 128 L350 250 L0 250 Z" fill={far} />
      <path d="M0 132 C60 120 130 126 196 134 C252 141 310 136 350 128" {...L} />
      <path d="M0 168 C80 158 180 176 350 162 L350 250 L0 250 Z" fill={ground} />
      <path d="M0 168 C80 158 180 176 350 162" {...L} />
      {children}
    </svg>
  );
}

const Sun = ({ x = 292, y = 52, r = 22 }: { x?: number; y?: number; r?: number }) => <><circle cx={x} cy={y} r={r} fill="#f4dc9e" stroke={INK} strokeWidth={3} /></>;

/** a bare tree, the stage for the crow that is not drawn */
export const FoxAndCrowArt = ({ view }: { view?: string } = {}) => (
  <Stage view={view}>
    <Sun x={54} y={54} r={20} />
    <path d="M232 170 C230 140 236 116 234 92" {...L} strokeWidth={11} />
    <path d="M234 108 L176 96 M234 122 L288 106 M234 96 L206 74" {...L} strokeWidth={6} />
    <path d="M176 96 L156 86 M176 96 L162 104" {...L} strokeWidth={4} />
    <path d="M288 106 L308 96" {...L} strokeWidth={4} />
    <ellipse cx="88" cy="170" rx="26" ry="11" fill="#a8825c" stroke={INK} strokeWidth={3} />
    <path d="M62 170 L62 184 C62 192 114 192 114 184 L114 170" fill="#8d6a48" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
    <path d="M74 168 C82 162 96 162 104 168" {...L} strokeWidth={2.5} />
  </Stage>
);

/** the hillside and the flock, with nobody minding it */
export const ShepherdArt = ({ view }: { view?: string } = {}) => (
  <Stage view={view} sky="#e7dcc0" ground="#cfe0c0">
    <Sun x={286} y={48} r={19} />
    {[[52, 178, 1], [110, 190, 0.86], [168, 180, 0.72], [214, 194, 0.6]].map(([x, y, s], i) => (
      <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
        <path d="M8 16 C0 6 10 -4 20 1 C23 -8 37 -8 41 1 C52 -4 60 8 50 17 C54 27 41 33 33 28 L20 28 C10 33 3 25 8 16 Z" fill="#fffdf7" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
        <path d="M20 28 L18 38 M34 28 L36 38" {...L} />
      </g>
    ))}
    <path d="M292 186 C298 150 292 128 296 112" {...L} strokeWidth={5} />
    <path d="M296 112 C306 104 314 116 304 122" {...L} strokeWidth={5} />
  </Stage>
);

/** the net on the ground, and a hole under the roots */
export const LionAndMouseArt = ({ view }: { view?: string } = {}) => (
  <Stage view={view} sky="#e9dcbf" ground="#cdd9ae" far="#bccb9c">
    <g transform="translate(96 156)" opacity="0.95">
      <path d="M0 0 L140 14 M6 22 L146 36 M12 44 L152 58" {...L} strokeWidth={3} />
      <path d="M8 -4 L-4 48 M48 1 L36 53 M88 6 L76 58 M128 11 L116 62" {...L} strokeWidth={3} />
    </g>
    <path d="M40 176 C48 166 64 166 72 176 C64 182 48 182 40 176 Z" fill="#4a3a2c" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
    <path d="M286 150 C300 146 316 152 318 164 C300 168 288 162 286 150 Z" fill="#9fb98a" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
  </Stage>
);

/** the empty race: a path, a stone, a post far away */
export const HareAndTortoiseArt = ({ view }: { view?: string } = {}) => (
  <Stage view={view} sky="#eadfc4" ground="#d2dfbc">
    <path d="M196 132 C170 156 140 176 60 202 L164 214 C230 188 252 154 258 132 Z" fill="#e6d7b6" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
    <ellipse cx="92" cy="182" rx="18" ry="12" fill="#b9b2a2" stroke={INK} strokeWidth={3} />
    <path d="M300 148 L300 110" {...L} strokeWidth={5} />
    <path d="M286 106 L322 100 L322 114 L286 120 Z" fill="#c9714a" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
  </Stage>
);

/** a mound of grain, and the dry grass of late summer */
export const AntAndGrasshopperArt = ({ view }: { view?: string } = {}) => (
  <Stage view={view} sky="#f0e0bc" ground="#d9cf9e" far="#cdc28e">
    <Sun x={74} y={54} r={21} />
    <path d="M196 174 C206 138 244 138 254 174 Z" fill="#e3b964" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
    <circle cx="214" cy="164" r="2.4" fill="#a97c2c" /><circle cx="228" cy="156" r="2.4" fill="#a97c2c" /><circle cx="238" cy="166" r="2.4" fill="#a97c2c" />
    {[70, 92, 114, 300, 322].map((x, i) => <path key={i} d={`M${x} 178 C${x - 4} 160 ${x + 2} 148 ${x - 2} 138`} {...L} strokeWidth={3} />)}
  </Stage>
);

/** the river, the far bank, and the fruit tree the monkey is not sitting in */
export const MonkeyAndCrocodileArt = ({ view }: { view?: string } = {}) => (
  <Stage view={view} sky="#e4dcc6" ground="#bcd0c4" far="#cbdcd2">
    <path d="M0 150 L350 150 L350 208 L0 208 Z" fill="#9fc3cc" />
    <path d="M0 150 L350 150 M0 208 L350 208" {...L} />
    <path d="M40 166 C64 160 84 172 110 166 M210 190 C238 184 258 194 292 188" {...L} strokeWidth={2.5} />
    <path d="M118 148 C116 130 122 116 120 104" {...L} strokeWidth={8} />
    <circle cx="112" cy="92" r="20" fill="#8fae7a" stroke={INK} strokeWidth={3} />
    <circle cx="140" cy="102" r="14" fill="#7fa06a" stroke={INK} strokeWidth={3} />
    <ellipse cx="128" cy="112" rx="6" ry="8" fill="#e0913f" stroke={INK} strokeWidth={2.5} />
    <path d="M232 214 C252 208 286 208 306 214" {...L} strokeWidth={4} />
  </Stage>
);

/** the pot the jackal fell into, and what came out of it */
export const BlueJackalArt = ({ view }: { view?: string } = {}) => (
  <Stage view={view} sky="#e6dcc8" ground="#cbd9be">
    <path d="M150 128 L206 128 L200 182 C198 194 158 194 156 182 Z" fill="#7d8fc4" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
    <ellipse cx="178" cy="128" rx="28" ry="9" fill="#5f74b0" stroke={INK} strokeWidth={3} />
    <path d="M200 176 C224 180 246 190 252 200 L224 200 C216 190 208 184 198 182 Z" fill="#5f74b0" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
    <circle cx="268" cy="202" r="5" fill="#5f74b0" stroke={INK} strokeWidth={2.5} />
    <circle cx="284" cy="196" r="3.4" fill="#5f74b0" stroke={INK} strokeWidth={2.5} />
    <path d="M70 172 C66 150 74 136 70 122 M92 176 C88 158 96 146 92 134" {...L} strokeWidth={3} />
  </Stage>
);

/** Pat and the Tap: a tap over a pail, dripping */
export const PatAndTheTapArt = ({ view }: { view?: string } = {}) => (
  <Stage view={view} sky="#eadfc6" ground="#cfe0c0">
    <path d="M150 96 L150 132 L188 132" {...L} strokeWidth={9} />
    <path d="M138 90 L162 90" {...L} strokeWidth={7} />
    <path d="M150 90 L150 78" {...L} strokeWidth={5} />
    <path d="M140 74 L160 74" {...L} strokeWidth={6} />
    <path d="M188 144 C188 152 186 158 186 164" {...L} strokeWidth={3} />
    <ellipse cx="186" cy="176" rx="5" ry="7" fill="#9fc3cc" stroke={INK} strokeWidth={2.5} />
    <path d="M160 180 L214 180 L208 214 L166 214 Z" fill="#c9a06a" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
    <path d="M164 190 C180 196 194 196 210 190" {...L} strokeWidth={2.5} />
  </Stage>
);

/** Sam and the Pit: a path, and a hole in it */
export const SamAndThePitArt = ({ view }: { view?: string } = {}) => (
  <Stage view={view} sky="#e8dcc2" ground="#d3dfba">
    <path d="M140 132 C128 160 104 186 44 216 L150 216 C196 188 214 156 216 132 Z" fill="#e6d7b6" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
    <ellipse cx="128" cy="184" rx="30" ry="15" fill="#4a3a2c" stroke={INK} strokeWidth={3} />
    <ellipse cx="128" cy="180" rx="30" ry="15" fill="#6b563f" stroke={INK} strokeWidth={3} />
    <path d="M276 166 C272 138 280 122 276 106" {...L} strokeWidth={8} />
    <circle cx="272" cy="94" r="22" fill="#8fae7a" stroke={INK} strokeWidth={3} />
    <circle cx="300" cy="106" r="14" fill="#7fa06a" stroke={INK} strokeWidth={3} />
  </Stage>
);

/** Tap, Tap, Tap: a door, and whoever is on the other side of it */
export const TapTapTapArt = ({ view }: { view?: string } = {}) => (
  <Stage view={view} sky="#e9ddc2" ground="#cfe0c0">
    <path d="M132 76 L222 76 L222 190 L132 190 Z" fill="#c98f5c" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
    <path d="M144 88 L210 88 L210 128 L144 128 Z M144 140 L210 140 L210 178 L144 178 Z" {...L} strokeWidth={3} />
    <circle cx="206" cy="136" r="4.5" fill="#f4dc9e" stroke={INK} strokeWidth={3} />
    <path d="M120 190 L234 190" {...L} strokeWidth={5} />
    <path d="M250 110 C266 106 268 122 252 124 M256 140 C274 136 276 152 258 154" {...L} strokeWidth={3} />
  </Stage>
);

/**
 * The square on the bookshelf and the home card. Four of the Aesop books use Milo Winter's 1919
 * plates (public domain); the rest zoom into their own banner, so one drawing serves both frames.
 */
export const PLATE_COVERS = new Set(["fox-and-crow", "lion-and-mouse", "hare-and-tortoise", "ant-and-grasshopper"]);
export const COVER_ZOOM: Record<string, string> = {
  "boy-who-cried-wolf": "46 130 120 120",
  "monkey-and-crocodile": "78 68 120 120",
  "blue-jackal": "130 108 110 110",
  "pat-and-the-tap": "126 62 110 110",
  "sam-and-the-pit": "78 134 110 110",
  "tap-tap-tap": "120 66 114 114",
};

export const STORY_ART: Record<string, (p?: { view?: string }) => React.JSX.Element> = {
  "fox-and-crow": FoxAndCrowArt,
  "boy-who-cried-wolf": ShepherdArt,
  "lion-and-mouse": LionAndMouseArt,
  "hare-and-tortoise": HareAndTortoiseArt,
  "ant-and-grasshopper": AntAndGrasshopperArt,
  "monkey-and-crocodile": MonkeyAndCrocodileArt,
  "blue-jackal": BlueJackalArt,
  "pat-and-the-tap": PatAndTheTapArt,
  "sam-and-the-pit": SamAndThePitArt,
  "tap-tap-tap": TapTapTapArt,
};
