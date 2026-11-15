// Eigene, schlichte Illustrationen für die Bildstudio-Tools
const S = { stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const L = { ...S, fill: "none" };

function Shirt({ x = 0, y = 0, s = 1, fill = "#1a2023" }: { x?: number; y?: number; s?: number; fill?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-22 -26 L-8 -32 Q0 -24 8 -32 L22 -26 L34 -8 L22 -2 L22 32 L-22 32 L-22 -2 L-34 -8 Z" fill={fill} {...S} />
      <path d="M0 -24 L0 32" {...L} strokeWidth={1.4} opacity={0.6} />
    </g>
  );
}

function Person({ x = 0, y = 0 }: { x?: number; y?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle cx="0" cy="-46" r="10" fill="#253033" />
      <path d="M-20 -30 L20 -30 L28 -2 L18 0 L16 18 L-16 18 L-18 0 L-28 -2 Z" fill="#1a2023" {...S} />
      <path d="M-14 18 L-12 56 M14 18 L12 56" {...L} strokeWidth={9} stroke="#253033" />
      <path d="M-18 58 L-6 58 M6 58 L18 58" {...L} strokeWidth={5} stroke="#e6ecee" />
    </g>
  );
}

export function ToolArt({ tool }: { tool: string }) {
  return (
    <svg viewBox="0 0 240 140" className="h-full w-full text-accent">
      <defs>
        <radialGradient id={`g-${tool}`} cx="50%" cy="45%" r="65%">
          <stop offset="0%" stopColor="#34d3b4" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#34d3b4" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="240" height="140" fill={`url(#g-${tool})`} />
      {tool === "tryon" && (<><Shirt x={70} y={72} /><path d="M108 72 L128 72 M120 64 L128 72 L120 80" {...L} /><Person x={170} y={70} /></>)}
      {tool === "bulk" && (<>
        {[60, 120, 180].map((x, i) => (<g key={x}><rect x={x - 28} y={34} width={56} height={72} rx={8} fill="#131719" {...S} strokeWidth={1.4} opacity={0.5} transform={`translate(5 -5)`} /><rect x={x - 28} y={34} width={56} height={72} rx={8} fill="#1a2023" {...S} strokeWidth={1.6} /><Shirt x={x} y={70} s={0.55 + i * 0} fill="#253033" /></g>))}
      </>)}
      {tool === "custom" && (<><rect x="74" y="28" width="92" height="84" rx="2" {...L} strokeDasharray="5 5" strokeWidth={1.4} /><Shirt x={120} y={72} s={0.9} /><path d="M160 100 L188 72" {...L} strokeWidth={4} /><path d="M192 56 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3z" fill="currentColor" stroke="none" /></>)}
      {tool === "flatlay" && (<><rect x="40" y="18" width="160" height="104" rx="10" fill="#131719" {...S} strokeWidth={1.2} opacity={0.8} /><Shirt x={92} y={64} s={0.8} /><rect x="138" y="42" width="34" height="56" rx="4" fill="#1a2023" {...S} /><ellipse cx="160" cy="108" rx="16" ry="6" fill="#e6ecee" stroke="none" opacity={0.8} /></>)}
      {tool === "background" && (<>
        <g opacity={0.5}>{Array.from({ length: 8 }).map((_, r) => Array.from({ length: 10 }).map((__, c) => ((r + c) % 2 ? <rect key={`${r}-${c}`} x={70 + c * 10} y={30 + r * 10} width="10" height="10" fill="#253033" /> : null)))}</g>
        <rect x="70" y="30" width="100" height="80" rx="4" {...L} strokeWidth={1.2} /><Shirt x={120} y={70} s={0.85} /><rect x="168" y="92" width="26" height="14" rx="3" transform="rotate(-25 181 99)" fill="#e6ecee" stroke="none" />
      </>)}
      {tool === "enhance" && (<><Shirt x={80} y={72} s={0.9} fill="#131719" /><path d="M64 58 q6 6 0 12 M88 80 q6 6 0 12" {...L} strokeWidth={1.4} opacity={0.6} /><path d="M112 72 L130 72 M122 64 L130 72 L122 80" {...L} /><Shirt x={168} y={72} s={0.9} /><path d="M196 44 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5z" fill="currentColor" stroke="none" /></>)}
    </svg>
  );
}
