import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export const controlClasses =
  'block w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 disabled:bg-gray-100 disabled:text-gray-500 aria-[invalid=true]:border-red-500'

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
    <select className={cn(controlClasses, 'h-10 pr-8', className)} {...rest}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode
  description?: ReactNode
}

export function Checkbox({ label, description, className, id, ...rest }: CheckboxProps) {
  return (
    <label htmlFor={id} className={cn('flex items-start gap-3 text-sm', className)}>
      <input id={id} type="checkbox" className="mt-0.5 size-4 shrink-0 accent-gray-900" {...rest} />
      <span>
        <span className="font-medium text-gray-900">{label}</span>
        {description && <span className="mt-0.5 block text-gray-500">{description}</span>}
      </span>
    </label>
  )
}

export function SearchInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <Input type="search" className={cn('min-w-0', className)} {...rest} />
}
