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
    {/* no hole: a dark rimmed oval is the pit Sam falls into two books away, and this fable's word is
        "net". Tall grass instead, in tufts - evenly spaced blades over a band edge read as a mesh. */}
    {[[38, 1], [116, 0.85], [212, 1.05], [292, 0.78]].map(([x, k], i) => (
      <g key={i}>
        <path d={`M${x} 236 C${x - 16} 218 ${x - 14} 206 ${x - 24} ${236 - 46 * (k as number)}`} {...L} strokeWidth={3.5} />
        <path d={`M${x + 4} 238 C${x + 2} 216 ${x + 8} 206 ${x + 4} ${238 - 58 * (k as number)}`} {...L} strokeWidth={3.5} />
        <path d={`M${x + 9} 236 C${x + 20} 220 ${x + 20} 208 ${x + 30} ${236 - 40 * (k as number)}`} {...L} strokeWidth={3.5} />
      </g>
    ))}
    <path d="M250 176 C266 170 288 178 290 192 C268 196 252 190 250 176 Z" fill="#9fb98a" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
    <path d="M254 180 C268 184 280 188 288 192" {...L} strokeWidth={2.5} />
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
    <path d="M196 174 C206 138 244 138 254 174 Z" fill="#e3b964" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
    <path d="M212 166 L217 164 M226 158 L231 156 M236 168 L241 166" {...L} strokeWidth={2.5} />   {/* grain, not ants: three specks would be figures */}
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
    <path d="M128 178 C158 168 196 182 236 176 C258 172 274 180 288 190 C250 202 190 200 150 192 C136 189 128 184 128 178 Z" fill="#7d8fc4" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
    <circle cx="106" cy="186" r="6" fill="#5f74b0" stroke={INK} strokeWidth={2.5} />
    <circle cx="88" cy="196" r="4" fill="#5f74b0" stroke={INK} strokeWidth={2.5} />
    <path d="M70 176 C66 150 74 136 70 120 M92 180 C88 158 96 146 92 132 M300 176 C296 156 304 144 300 130" {...L} strokeWidth={3} />
  </Stage>
);

/** Pat and the Tap: a tap over a pail, dripping */
export const PatAndTheTapArt = ({ view }: { view?: string } = {}) => (
  <Stage view={view} sky="#eadfc6" ground="#cfe0c0">
    <path d="M146 160 L200 160 L194 200 L152 200 Z" fill="#c9a06a" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
    <path d="M150 170 C166 176 180 176 196 170" {...L} strokeWidth={2.5} />
    <ellipse cx="228" cy="196" rx="26" ry="8" fill="#a7c6cd" stroke={INK} strokeWidth={3} />
    <ellipse cx="256" cy="184" rx="9" ry="4" fill="#a7c6cd" stroke={INK} strokeWidth={2.5} />
  </Stage>
);

/** Sam and the Pit: a path, and a hole in it */
export const SamAndThePitArt = ({ view }: { view?: string } = {}) => (
  <Stage view={view} sky="#e8dcc2" ground="#d3dfba">
    <path d="M140 132 C128 160 104 186 44 216 L150 216 C196 188 214 156 216 132 Z" fill="#e6d7b6" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
    <path d="M96 190 C106 168 150 168 160 190 Z" fill="#8d6a48" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
    <path d="M112 182 L118 178 M132 176 L138 174 M144 184 L150 181" {...L} strokeWidth={2.5} />
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
  "tap-tap-tap": "120 66 114 114",
};

/** A cover may show the title object; the reading stage may not. These three are drawn only here. */
const CoverFrame = ({ bg = "#e9dcc2", ground = "#cfe0c0", children }: { bg?: string; ground?: string; children: React.ReactNode }) => (
  <svg viewBox="0 0 120 120" className="ill" preserveAspectRatio="xMidYMid slice" aria-hidden>
    <rect x="-10" y="-10" width="140" height="140" fill={bg} />
    <path d="M-10 84 C30 76 80 88 130 80 L130 130 L-10 130 Z" fill={ground} />
    <path d="M-10 84 C30 76 80 88 130 80" {...L} />
    {children}
  </svg>
);
export const BlueJackalCover = () => (
  <CoverFrame>
    <path d="M40 40 L86 40 L80 86 C78 96 46 96 44 86 Z" fill="#7d8fc4" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
    <ellipse cx="63" cy="40" rx="23" ry="7" fill="#5f74b0" stroke={INK} strokeWidth={3} />
    <path d="M80 82 C94 86 104 94 108 102 L88 102 C84 94 78 90 78 88 Z" fill="#5f74b0" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
  </CoverFrame>
);
export const PatAndTheTapCover = () => (
  <CoverFrame>
    <path d="M52 20 L52 58 L84 58" {...L} strokeWidth={9} />
    <path d="M40 16 L64 16" {...L} strokeWidth={8} />
    <path d="M84 70 C84 76 83 80 83 84" {...L} strokeWidth={3} />
    <path d="M60 86 L106 86 L100 112 L66 112 Z" fill="#c9a06a" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
  </CoverFrame>
);
export const SamAndThePitCover = () => (
  <CoverFrame ground="#d6dfc0">
    {/* a dark oval alone is a blob: the rim of turned earth and the heap beside it make it a hole */}
    <ellipse cx="54" cy="80" rx="36" ry="19" fill="#b99a6e" stroke={INK} strokeWidth={3} />
    <ellipse cx="54" cy="78" rx="27" ry="13" fill="#3b2f22" stroke={INK} strokeWidth={3} />
    <path d="M32 74 C40 68 68 68 76 74" fill="none" stroke="#6b563f" strokeWidth={3} strokeLinecap="round" />
    <path d="M86 66 C94 50 112 52 116 68 Z" fill="#8d6a48" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
    <path d="M95 62 L99 58 M105 60 L109 57" {...L} strokeWidth={2.5} />
    <path d="M14 70 C12 60 18 54 15 46" {...L} strokeWidth={3} />
  </CoverFrame>
);
export const COVER_ART: Record<string, () => React.JSX.Element> = {
  "blue-jackal": BlueJackalCover,
  "pat-and-the-tap": PatAndTheTapCover,
  "sam-and-the-pit": SamAndThePitCover,
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
