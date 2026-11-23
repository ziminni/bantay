import { cn } from '@/lib/cn'

type Tone = 'brand' | 'light' | 'muted'

const strokes: Record<Tone, string> = {
  brand: '#0e2a47',
  light: '#f7f5f0',
  muted: 'currentColor',
}

/**
 * The Bantay mark — an eye inside scan brackets — drawn as SVG so it stays
 * sharp at any size (icons, empty states, the camera placeholder).
 * The full logos with the wordmark are the PNG files in assets/brand/.
 */
export function BrandMark({ tone = 'brand', className }: { tone?: Tone; className?: string }) {
  const stroke = strokes[tone]
  const muted = tone === 'muted'
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden className={cn('shrink-0', className)}>
      <g stroke={stroke} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 14V9.5A4.5 4.5 0 0 1 9.5 5H14" />
        <path d="M34 5h4.5A4.5 4.5 0 0 1 43 9.5V14" />
        <path d="M43 34v4.5a4.5 4.5 0 0 1-4.5 4.5H34" />
        <path d="M14 43H9.5A4.5 4.5 0 0 1 5 38.5V34" />
        <path d="M11 24c3.6-5.4 8-8 13-8s9.4 2.6 13 8c-3.6 5.4-8 8-13 8s-9.4-2.6-13-8Z" />
      </g>
      <circle cx="24" cy="24" r="5" fill={muted ? 'currentColor' : '#f2a93b'} opacity={muted ? 0.6 : 1} />
      <circle cx="24" cy="24" r="1.9" fill={muted ? 'white' : '#0e2a47'} opacity={muted ? 0.9 : 1} />
    </svg>
  )
}
