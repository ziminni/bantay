import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/cn'

export const controlClasses =
  'block w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-navy-900 shadow-card transition-[border-color,box-shadow] placeholder:text-gray-400 hover:border-gray-300 focus:border-navy-400 focus:ring-3 focus:ring-marigold-200 focus:outline-none focus-visible:outline-none disabled:bg-gray-100 disabled:text-gray-500 aria-[invalid=true]:border-red-400 aria-[invalid=true]:focus:ring-red-100'

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlClasses, 'h-10', className)} {...rest} />
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(controlClasses, 'py-2', className)} {...rest} />
}

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  options: SelectOption[]
  /** Adds an empty first option, e.g. "All labs". */
  placeholder?: string
}

export function Select({ options, placeholder, className, ...rest }: SelectProps) {
  return (
    <div className="relative">
      <select className={cn(controlClasses, 'h-10 cursor-pointer appearance-none pr-9', className)} {...rest}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-gray-500" />
    </div>
  )
}

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode
  description?: ReactNode
}

export function Checkbox({ label, description, className, id, ...rest }: CheckboxProps) {
  return (
    <label htmlFor={id} className={cn('flex items-start gap-3 text-sm', className)}>
      <input id={id} type="checkbox" className="mt-0.5 size-4 shrink-0 rounded accent-navy-900" {...rest} />
      <span>
        <span className="font-medium text-gray-900">{label}</span>
        {description && <span className="mt-0.5 block text-gray-500">{description}</span>}
      </span>
    </label>
  )
}

/** A text input with a magnifying-glass icon. */
export function SearchInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative min-w-0">
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
      <Input type="search" className={cn('pl-9', className)} {...rest} />
    </div>
  )
}
