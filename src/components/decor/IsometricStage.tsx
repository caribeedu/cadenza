import "./IsometricStage.css";

type Props = {
  variant?: "home" | "load";
};

export function IsometricStage(props: Props) {
  const variant = () => props.variant ?? "home";

  return (
    <div class="iso-stage" data-variant={variant()} aria-hidden="true">
      <svg class="iso-stage__svg" viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="iso-key-white" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#f5f5f5" />
            <stop offset="100%" stop-color="#d8d8d8" />
          </linearGradient>
          <linearGradient id="iso-key-black" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#3a3a48" />
            <stop offset="100%" stop-color="#1a1a24" />
          </linearGradient>
          <linearGradient id="iso-glow" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.6" />
            <stop offset="100%" stop-color="var(--accent-secondary)" stop-opacity="0.2" />
          </linearGradient>
        </defs>

        {/* Staff lines — isometric */}
        <g class="iso-staff" transform="translate(40, 30) skewY(-12)">
          {[0, 12, 24, 36, 48].map((y) => (
            <line x1="0" y1={y} x2="240" y2={y} stroke="rgba(255,255,255,0.12)" stroke-width="1.5" />
          ))}
          <circle cx="200" cy="24" r="6" fill="var(--accent)" opacity="0.8" class="iso-note" />
          <circle cx="160" cy="12" r="5" fill="var(--accent-secondary)" opacity="0.7" class="iso-note iso-note--delay" />
        </g>

        {/* Piano platform */}
        <g transform="translate(60, 100)">
          <polygon
            points="0,60 120,30 240,60 120,90"
            fill="rgba(0,0,0,0.4)"
            stroke="rgba(255,255,255,0.08)"
          />
          <g transform="translate(20, 10) skewX(-30) skewY(10)">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <rect
                x={i * 26}
                y="0"
                width="22"
                height="48"
                rx="3"
                fill="url(#iso-key-white)"
                stroke="#aaa"
                stroke-width="0.5"
              />
            ))}
            {[0, 1, 2, 3, 4, 5].map((i) =>
              i === 2 || i === 5 ? null : (
                <rect
                  x={i * 26 + 16}
                  y="0"
                  width="14"
                  height="30"
                  rx="2"
                  fill="url(#iso-key-black)"
                />
              ),
            )}
          </g>
        </g>

        {/* Glow orb */}
        <ellipse cx="260" cy="50" rx="40" ry="25" fill="url(#iso-glow)" class="iso-glow" />

        {variant() === "load" ? (
          <g class="iso-pipeline" transform="translate(20, 155)">
            <rect x="0" y="0" width="80" height="28" rx="6" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.1)" />
            <text x="40" y="18" text-anchor="middle" fill="var(--text-secondary)" font-size="10">
              MuseScore
            </text>
            <path d="M 90 14 L 130 14" stroke="var(--accent)" stroke-width="2" stroke-dasharray="4 3" class="iso-flow" />
            <polygon points="130,10 138,14 130,18" fill="var(--accent)" />
            <rect x="140" y="0" width="80" height="28" rx="6" fill="rgba(255,255,255,0.06)" stroke="var(--border-accent)" />
            <text x="180" y="18" text-anchor="middle" fill="var(--accent-secondary)" font-size="10">
              Cadenza
            </text>
          </g>
        ) : null}
      </svg>
    </div>
  );
}
