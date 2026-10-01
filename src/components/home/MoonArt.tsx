import React from 'react';

/** Decorative night sky for the guest hero. Pure SVG, so it adds no request and follows the theme colours. */
const MoonArt: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg viewBox="0 0 320 260" className={className} role="presentation" aria-hidden focusable="false">
    <defs>
      <linearGradient id="moon-body" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="rgb(var(--accent-text))" stopOpacity="0.95" />
        <stop offset="1" stopColor="rgb(var(--accent))" />
      </linearGradient>
      <radialGradient id="moon-glow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="rgb(var(--accent))" stopOpacity="0.35" />
        <stop offset="1" stopColor="rgb(var(--accent))" stopOpacity="0" />
      </radialGradient>
    </defs>
    <circle cx="170" cy="120" r="120" fill="url(#moon-glow)" />
    {/* the crescent: a full disc with a second disc cut out of it */}
    <mask id="moon-cut">
      <rect width="320" height="260" fill="white" />
      <circle cx="198" cy="104" r="58" fill="black" />
    </mask>
    <circle cx="160" cy="124" r="70" fill="url(#moon-body)" mask="url(#moon-cut)" />
    {/* stars */}
    {[
      [48, 52, 3],
      [92, 168, 2],
      [250, 56, 2.5],
      [278, 150, 3.5],
      [60, 112, 1.8],
      [226, 206, 2],
      [128, 40, 2],
      [290, 94, 1.6]
    ].map(([x, y, r], i) => (
      <circle key={i} cx={x} cy={y} r={r} fill="rgb(var(--highlight))" opacity={0.85}>
        <animate attributeName="opacity" values="0.35;0.95;0.35" dur={`${3 + (i % 4)}s`} repeatCount="indefinite" begin={`${i * 0.4}s`} />
      </circle>
    ))}
    {/* a few soft clouds */}
    <g fill="rgb(var(--surface-2))" opacity="0.9">
      <ellipse cx="96" cy="214" rx="54" ry="12" />
      <ellipse cx="130" cy="206" rx="34" ry="12" />
      <ellipse cx="240" cy="184" rx="44" ry="10" />
    </g>
  </svg>
);

export default MoonArt;
