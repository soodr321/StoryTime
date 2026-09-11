/** Inline SVG icons and mascots: one stroke style, currentColor, no emoji. */
import type { ReactNode } from "react";

const I = ({ children, size = 22, stroke = 2 }: { children: ReactNode; size?: number; stroke?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden>{children}</svg>
);
export const HomeIcon = ({ size }: { size?: number }) => <I size={size}><path d="M3 11 12 4l9 7" /><path d="M5 10v10h14V10" /></I>;
export const FamilyIcon = ({ size }: { size?: number }) => <I size={size}><circle cx="8" cy="8" r="3" /><circle cx="16.5" cy="9.5" r="2.5" /><path d="M2.5 20c0-3.5 2.5-6 5.5-6s5.5 2.5 5.5 6" /><path d="M13 19c.3-2.6 1.8-4.5 3.8-4.5s3.5 1.9 3.7 4.5" /></I>;
export const GearIcon = ({ size }: { size?: number }) => <I size={size}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></I>;
export const SpeakerIcon = ({ size }: { size?: number }) => <I size={size}><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /></I>;
export const BookIcon = ({ size }: { size?: number }) => <I size={size}><path d="M4 5a2 2 0 0 1 2-2h5v18H6a2 2 0 0 1-2-2z" /><path d="M20 5a2 2 0 0 0-2-2h-5v18h5a2 2 0 0 0 2-2z" /></I>;
export const CheckIcon = ({ size }: { size?: number }) => <I size={size} stroke={2.6}><path d="M5 12l5 5L19 7" /></I>;
export const LockIcon = ({ size }: { size?: number }) => <I size={size}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></I>;
export const MoonIcon = ({ size }: { size?: number }) => <I size={size}><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></I>;
export const RedoIcon = ({ size }: { size?: number }) => <I size={size}><path d="M4 12a8 8 0 1 1 2.3 5.7" /><path d="M4 20v-5h5" /></I>;
export const StarIcon = ({ size = 18, filled = true }: { size?: number; filled?: boolean }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={filled ? "var(--star)" : "none"} stroke={filled ? "var(--star-ink)" : "var(--line)"} strokeWidth="1.5" strokeLinejoin="round" aria-hidden><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" /></svg>
);

/** The two mascots from the first story: a fox and a crow, one stroke style. */
export const Fox = ({ size = 110 }: { size?: number }) => (
  <svg viewBox="0 0 120 120" width={size} height={size} fill="none" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M20 40 L36 70 L84 70 L100 40 L78 52 L60 44 L42 52 Z" fill="#f4a261" /><path d="M36 70 C36 96 84 96 84 70" fill="#fff3e8" />
    <circle cx="50" cy="60" r="3" fill="var(--ink)" /><circle cx="70" cy="60" r="3" fill="var(--ink)" /><path d="M56 78 L60 82 L64 78" />
    <path d="M20 40 L30 20 L44 38" fill="#f4a261" /><path d="M100 40 L90 20 L76 38" fill="#f4a261" />
  </svg>
);
export const Crow = ({ size = 90 }: { size?: number }) => (
  <svg viewBox="0 0 120 120" width={size} height={size} fill="none" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <ellipse cx="60" cy="68" rx="34" ry="26" fill="#5c5c6e" /><circle cx="82" cy="46" r="16" fill="#5c5c6e" /><circle cx="87" cy="43" r="3" fill="#fff" />
    <path d="M96 46 L112 50 L96 54 Z" fill="#f2c14e" /><path d="M30 60 C14 56 10 70 24 76" fill="#5c5c6e" /><path d="M50 94 L50 104 M70 94 L70 104" />
  </svg>
);
export const Mascots = ({ scale = 1 }: { scale?: number }) => <div className="mascots" aria-hidden><Fox size={110 * scale} /><Crow size={86 * scale} /></div>;
