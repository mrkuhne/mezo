// ============================================================
// Mezo · Abstract conceptual icons (SVG, custom)
// Today = clock-meso · Train = mesocycle wave · Fuel = hexagon-molecule
// Insights = constellation · Me = concentric depth
// ============================================================

export type IconName =
  | 'today'
  | 'train'
  | 'fuel'
  | 'insights'
  | 'me'
  | 'mic'
  | 'camera'
  | 'plus'
  | 'minus'
  | 'check'
  | 'x'
  | 'chevron-right'
  | 'chevron-down'
  | 'chevron-up'
  | 'send'
  | 'heart'
  | 'bookmark'
  | 'settings'
  | 'search'
  | 'drop'
  | 'pill'
  | 'warning'
  | 'sparkle'
  | 'anchor'
  | 'graph'
  | 'tool'
  | 'sun'
  | 'moon'
  | 'voice-wave'
  | 'pencil'
  | 'trash'

export function Icon({
  name,
  size = 24,
  color = 'currentColor',
  strokeWidth = 1.5,
}: {
  name: IconName
  size?: number
  color?: string
  strokeWidth?: number
}) {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  switch (name) {
    case 'today':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 6.5 L12 12 L15.5 14" />
          <path d="M3.5 12 L5 12" />
          <path d="M19 12 L20.5 12" />
        </svg>
      )
    case 'train':
      // Mesocycle wave: MEV→MAV→MRV→deload curve
      return (
        <svg {...props}>
          <path d="M3 16 Q6 16 7 12 Q8 7 11 7 Q14 7 14 11 Q14 16 17 16 Q19 16 21 13" />
          <circle cx="7" cy="12" r="1" fill={color} />
          <circle cx="11" cy="7" r="1" fill={color} />
          <circle cx="14" cy="11" r="1" fill={color} />
          <circle cx="17" cy="16" r="1" fill={color} />
        </svg>
      )
    case 'fuel':
      // Hexagon molecule
      return (
        <svg {...props}>
          <polygon points="12,3.5 19,7.5 19,15.5 12,19.5 5,15.5 5,7.5" />
          <circle cx="12" cy="11.5" r="2" />
          <line x1="12" y1="3.5" x2="12" y2="9.5" />
        </svg>
      )
    case 'insights':
      // Constellation (5 nodes + edges)
      return (
        <svg {...props}>
          <circle cx="5" cy="6" r="1.5" fill={color} />
          <circle cx="12" cy="4" r="1.2" fill={color} />
          <circle cx="19" cy="8" r="1.5" fill={color} />
          <circle cx="9" cy="17" r="1.8" fill={color} />
          <circle cx="17" cy="18" r="1.3" fill={color} />
          <line x1="5" y1="6" x2="12" y2="4" opacity="0.6" />
          <line x1="12" y1="4" x2="19" y2="8" opacity="0.6" />
          <line x1="19" y1="8" x2="17" y2="18" opacity="0.6" />
          <line x1="17" y1="18" x2="9" y2="17" opacity="0.6" />
          <line x1="9" y1="17" x2="5" y2="6" opacity="0.6" />
        </svg>
      )
    case 'me':
      // Concentric depth
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="2" fill={color} />
          <circle cx="12" cy="12" r="5.5" opacity="0.7" />
          <circle cx="12" cy="12" r="9" opacity="0.4" />
        </svg>
      )

    // Functional icons
    case 'mic':
      return (
        <svg {...props}>
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11 V12 A7 7 0 0 0 19 12 V11" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
      )
    case 'camera':
      return (
        <svg {...props}>
          <path d="M4 8 H7 L9 6 H15 L17 8 H20 V18 H4 Z" />
          <circle cx="12" cy="13" r="3.2" />
        </svg>
      )
    case 'plus':
      return (
        <svg {...props}>
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      )
    case 'minus':
      return (
        <svg {...props}>
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      )
    case 'check':
      return (
        <svg {...props}>
          <polyline points="4,12 10,18 20,6" />
        </svg>
      )
    case 'x':
      return (
        <svg {...props}>
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="18" y1="6" x2="6" y2="18" />
        </svg>
      )
    case 'chevron-right':
      return (
        <svg {...props}>
          <polyline points="9,4 17,12 9,20" />
        </svg>
      )
    case 'chevron-down':
      return (
        <svg {...props}>
          <polyline points="4,9 12,17 20,9" />
        </svg>
      )
    case 'chevron-up':
      return (
        <svg {...props}>
          <polyline points="4,15 12,7 20,15" />
        </svg>
      )
    case 'send':
      return (
        <svg {...props}>
          <path d="M3 12 L21 3 L13 21 L11 13 Z" />
          <line x1="11" y1="13" x2="21" y2="3" />
        </svg>
      )
    case 'heart':
      return (
        <svg {...props}>
          <path d="M12 21 C8 17 3 13.5 3 9 A5 5 0 0 1 12 6 A5 5 0 0 1 21 9 C21 13.5 16 17 12 21 Z" />
        </svg>
      )
    case 'bookmark':
      return (
        <svg {...props}>
          <path d="M6 3 H18 V21 L12 17 L6 21 Z" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="2.5" />
          <path d="M12 3 V5 M12 19 V21 M3 12 H5 M19 12 H21 M5.6 5.6 L7 7 M17 17 L18.4 18.4 M5.6 18.4 L7 17 M17 7 L18.4 5.6" />
        </svg>
      )
    case 'search':
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="6.5" />
          <line x1="16" y1="16" x2="21" y2="21" />
        </svg>
      )
    case 'drop':
      return (
        <svg {...props}>
          <path d="M12 3 C12 3 5 11 5 15 A7 7 0 0 0 19 15 C19 11 12 3 12 3 Z" />
        </svg>
      )
    case 'pill':
      return (
        <svg {...props}>
          <rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-30 12 12)" />
          <line x1="9" y1="9" x2="13" y2="15" transform="rotate(-30 12 12)" />
        </svg>
      )
    case 'warning':
      return (
        <svg {...props}>
          <path d="M12 4 L21 19 L3 19 Z" />
          <line x1="12" y1="10" x2="12" y2="14" />
          <circle cx="12" cy="16.5" r="0.5" fill={color} />
        </svg>
      )
    case 'sparkle':
      return (
        <svg {...props}>
          <path d="M12 3 L13.5 10 L21 12 L13.5 14 L12 21 L10.5 14 L3 12 L10.5 10 Z" />
        </svg>
      )
    case 'anchor':
      return (
        <svg {...props}>
          <circle cx="12" cy="6" r="2" />
          <line x1="12" y1="8" x2="12" y2="21" />
          <path d="M5 15 C5 19 8 21 12 21 C16 21 19 19 19 15" />
          <line x1="8" y1="11" x2="16" y2="11" />
        </svg>
      )
    case 'graph':
      return (
        <svg {...props}>
          <circle cx="6" cy="6" r="2" />
          <circle cx="18" cy="6" r="2" />
          <circle cx="12" cy="14" r="2.5" />
          <circle cx="6" cy="20" r="1.5" />
          <line x1="7.5" y1="7.5" x2="11" y2="12.5" />
          <line x1="13" y1="12.5" x2="16.5" y2="7.5" />
          <line x1="11" y1="15.5" x2="7" y2="19" />
        </svg>
      )
    case 'tool':
      return (
        <svg {...props}>
          <path d="M14.5 3 A4 4 0 0 0 11 9 L4 16 L7 19 L14 12 A4 4 0 0 0 20 8.5 L17 11 L14 8 Z" />
        </svg>
      )
    case 'sun':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="4" />
          <line x1="12" y1="2" x2="12" y2="5" />
          <line x1="12" y1="19" x2="12" y2="22" />
          <line x1="2" y1="12" x2="5" y2="12" />
          <line x1="19" y1="12" x2="22" y2="12" />
          <line x1="4.9" y1="4.9" x2="7" y2="7" />
          <line x1="17" y1="17" x2="19.1" y2="19.1" />
          <line x1="4.9" y1="19.1" x2="7" y2="17" />
          <line x1="17" y1="7" x2="19.1" y2="4.9" />
        </svg>
      )
    case 'moon':
      return (
        <svg {...props}>
          <path d="M20 14.5 A8 8 0 1 1 9.5 4 A6 6 0 0 0 20 14.5 Z" />
        </svg>
      )
    case 'voice-wave':
      return (
        <svg {...props}>
          <line x1="5" y1="12" x2="5" y2="12" />
          <line x1="9" y1="9" x2="9" y2="15" />
          <line x1="13" y1="5" x2="13" y2="19" />
          <line x1="17" y1="8" x2="17" y2="16" />
          <line x1="21" y1="11" x2="21" y2="13" />
        </svg>
      )
    case 'pencil':
      // Edit / author affordance
      return (
        <svg {...props}>
          <path d="M4 20 L4 16 L15 5 L19 9 L8 20 Z" />
          <line x1="13" y1="7" x2="17" y2="11" />
        </svg>
      )
    case 'trash':
      // Delete affordance
      return (
        <svg {...props}>
          <path d="M5 7 L19 7" />
          <path d="M9 7 L9 5 L15 5 L15 7" />
          <path d="M6.5 7 L7.5 20 L16.5 20 L17.5 7" />
          <line x1="10" y1="10.5" x2="10" y2="16.5" />
          <line x1="14" y1="10.5" x2="14" y2="16.5" />
        </svg>
      )
    default:
      return null
  }
}

// Brand mark "M" (mesocycle wave inside)
export function BrandGlyph({ size = 24, color = 'var(--brand-glow)' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M3 19 V5 L8 13 L12 8 L16 13 L21 5 V19" stroke={color} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Status bar icons
export function StatusIcons() {
  return (
    <div className="status-icons">
      <svg viewBox="0 0 18 12"><path d="M0 10 H3 V12 H0 Z M5 7 H8 V12 H5 Z M10 4 H13 V12 H10 Z M15 0 H18 V12 H15 Z" /></svg>
      <svg viewBox="0 0 18 14"><path d="M9 0 C5 0 1.5 1.5 0 3.5 L2 5.5 C3 4 6 3 9 3 C12 3 15 4 16 5.5 L18 3.5 C16.5 1.5 13 0 9 0 Z M9 5 C7 5 5 5.5 4 6.5 L6 8.5 C7 7.5 8 7 9 7 C10 7 11 7.5 12 8.5 L14 6.5 C13 5.5 11 5 9 5 Z M9 9 C8.5 9 8 9.2 7.5 9.7 L9 11.5 L10.5 9.7 C10 9.2 9.5 9 9 9 Z" /></svg>
      <svg viewBox="0 0 26 12"><rect x="0" y="1" width="22" height="10" rx="2.5" stroke="white" strokeWidth="1" fill="none" /><rect x="2" y="3" width="18" height="6" rx="1" /><rect x="23" y="4" width="2" height="4" rx="1" /></svg>
    </div>
  )
}
