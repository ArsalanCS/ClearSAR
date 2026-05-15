export default function RadarSVG() {
  return (
    <svg viewBox="0 0 500 500" overflow="visible">
      <defs>
        <radialGradient id="sweep" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff6a2c" stopOpacity=".55"/>
          <stop offset="60%" stopColor="#ff6a2c" stopOpacity=".1"/>
          <stop offset="100%" stopColor="#ff6a2c" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff6a2c" stopOpacity=".18"/>
          <stop offset="100%" stopColor="#ff6a2c" stopOpacity="0"/>
        </radialGradient>
      </defs>

      <circle cx="250" cy="250" r="240" fill="url(#glow)"/>

      {/* Rings */}
      <g fill="none" stroke="#2a313d" strokeWidth="1">
        <circle cx="250" cy="250" r="220"/>
        <circle cx="250" cy="250" r="170" strokeDasharray="3 4"/>
        <circle cx="250" cy="250" r="120"/>
        <circle cx="250" cy="250" r="70" strokeDasharray="3 4"/>
        <circle cx="250" cy="250" r="20"/>
      </g>

      {/* Crosshair */}
      <g stroke="#2a313d" strokeWidth="1" strokeDasharray="3 5">
        <line x1="10" y1="250" x2="490" y2="250"/>
        <line x1="250" y1="10" x2="250" y2="490"/>
      </g>

      {/* Tick marks */}
      <g stroke="#ff6a2c" strokeWidth="1">
        <line x1="250" y1="10" x2="250" y2="22"/>
        <line x1="250" y1="478" x2="250" y2="490"/>
        <line x1="10" y1="250" x2="22" y2="250"/>
        <line x1="478" y1="250" x2="490" y2="250"/>
      </g>

      {/* Rotating sweep */}
      <g style={{ transformOrigin: '250px 250px', animation: 'spin 8s linear infinite' }}>
        <path d="M250 250 L250 30 A220 220 0 0 1 440 340 Z" fill="url(#sweep)"/>
        <line x1="250" y1="250" x2="250" y2="30" stroke="#ff6a2c" strokeWidth="1.5"/>
      </g>

      {/* Blip targets */}
      <g>
        <circle cx="180" cy="160" r="3" fill="#ff6a2c"/>
        <circle cx="180" cy="160" r="8" fill="none" stroke="#ff6a2c" strokeWidth="1">
          <animate attributeName="r" from="3" to="14" dur="2s" repeatCount="indefinite"/>
          <animate attributeName="opacity" from="1" to="0" dur="2s" repeatCount="indefinite"/>
        </circle>
        <circle cx="340" cy="200" r="3" fill="#ff6a2c"/>
        <circle cx="290" cy="340" r="3" fill="#2ad3b5"/>
        <circle cx="160" cy="330" r="3" fill="#2ad3b5"/>
        <circle cx="380" cy="110" r="2" fill="#ff6a2c" opacity=".7"/>
      </g>

      {/* Globe wireframe center */}
      <g opacity=".4" stroke="#5b6472" strokeWidth=".8" fill="none">
        <ellipse cx="250" cy="250" rx="60" ry="60"/>
        <ellipse cx="250" cy="250" rx="60" ry="18"/>
        <ellipse cx="250" cy="250" rx="60" ry="36"/>
        <ellipse cx="250" cy="250" rx="18" ry="60"/>
        <ellipse cx="250" cy="250" rx="36" ry="60"/>
      </g>

      {/* Center dot */}
      <circle cx="250" cy="250" r="5" fill="#ff6a2c"/>
      <circle cx="250" cy="250" r="14" fill="none" stroke="#ff6a2c" strokeWidth="1">
        <animate attributeName="r" from="5" to="24" dur="2.4s" repeatCount="indefinite"/>
        <animate attributeName="opacity" from=".8" to="0" dur="2.4s" repeatCount="indefinite"/>
      </circle>

      {/* Bearing labels */}
      <g fontFamily="JetBrains Mono" fontSize="9" fill="#5b6472" letterSpacing="1">
        <text x="250" y="8" textAnchor="middle">N 00°</text>
        <text x="497" y="253" textAnchor="end">E 090°</text>
        <text x="250" y="499" textAnchor="middle">S 180°</text>
        <text x="3" y="253">W 270°</text>
      </g>
    </svg>
  )
}
