// The Gagrafa logo, redrawn as strokes from thegagrafa.com's logo-1.png (only 266 × 93 px online).
// It takes the surrounding text colour: white on photos, navy on light headers.
export function Logo({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 800 280"
      role="img"
      aria-label="The Gagrafa"
      fill="none"
      stroke="currentColor"
      strokeLinejoin="round"
      className={className}
    >
      <g strokeWidth="12">
        <path d="M185 9H244M212 9V58" />
        <path d="M254 4V58M300 4V58M254 31H300" />
        <path d="M355 9H317V53H355M317 31H350" />
      </g>
      <path strokeWidth="8" d="M10 54L181 52M376 54L600 52" />
      <g strokeWidth="18">
        <circle cx="67" cy="148" r="47" />
        <path d="M67 101H131M104 167A55 55 0 1 1 15 226" />
        <circle cx="209" cy="148" r="47" />
        <path d="M256 150L262 203" />
        <circle cx="345" cy="148" r="47" />
        <path d="M345 101H402M383 165A55 55 0 1 1 294 224" />
        <path d="M434 199L429 150C428 120 452 101 490 98" />
        <circle cx="553" cy="148" r="47" />
        <path d="M600 150L603 199" />
        <path d="M641 199L634 92C634 68 650 54 682 50M612 105H672" />
        <circle cx="744" cy="148" r="47" />
        <path d="M791 150V198" />
      </g>
    </svg>
  );
}
