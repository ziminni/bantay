import appIcon from '@/assets/brand/app-icon.png'
import lockup from '@/assets/brand/lockup.png'
import lockupOnDark from '@/assets/brand/lockup-on-dark.png'
import stacked from '@/assets/brand/stacked.png'
import { cn } from '@/lib/cn'

const sources = {
  /** Horizontal logo for light backgrounds. */
  lockup,
  /** Horizontal logo for the navy sidebar. */
  'lockup-on-dark': lockupOnDark,
  /** Mark above the wordmark, with the university name. */
  stacked,
  /** The rounded navy app tile. */
  icon: appIcon,
}

export function Logo({ variant = 'lockup', className }: { variant?: keyof typeof sources; className?: string }) {
  return <img src={sources[variant]} alt="Bantay" className={cn('select-none', className)} draggable={false} />
}
