import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-[background-color,border-color,color,box-shadow] duration-150 disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:size-4 [&_svg]:shrink-0'

const variants: Record<Variant, string> = {
  primary: 'bg-navy-900 text-cream shadow-card hover:bg-navy-800 active:bg-navy-950',
  accent: 'bg-marigold-400 text-navy-950 shadow-card hover:bg-marigold-300 active:bg-marigold-500',
  secondary: 'border border-gray-200 bg-white text-navy-900 shadow-card hover:border-gray-300 hover:bg-gray-50',
  ghost: 'text-gray-600 hover:bg-gray-100 hover:text-navy-900',
  danger: 'border border-red-200 bg-white text-red-700 shadow-card hover:border-red-300 hover:bg-red-50',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
}

function buttonClasses(variant: Variant = 'secondary', size: Size = 'md', className?: string) {
  return cn(base, variants[variant], sizes[size], className)
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  )
}

interface ButtonLinkProps extends LinkProps {
  variant?: Variant
  size?: Size
  icon?: ReactNode
}

export function ButtonLink({ variant = 'secondary', size = 'md', icon, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...rest}>
      {icon}
      {children}
    </Link>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent', className)}
    />
  )
}
