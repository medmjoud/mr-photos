import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { useTranslations } from 'use-intl'
import { cx } from '@/lib/cx'

type FieldProps = {
  label: ReactNode
  hint?: ReactNode
  error?: string | null
  required?: boolean
  className?: string
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode
}

/** Label + control + hint + error, wired for screen readers. */
export function Field({ label, hint, error, required, className, children }: FieldProps) {
  const t = useTranslations('common')
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-small font-semibold text-ink">
        {label}
        {required ? null : <span className="ms-1.5 font-normal text-ink-subtle">({t('optional')})</span>}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint ? (
        <p id={hintId} className="text-small text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-small font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cx('control', className)} {...rest} />
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cx('control', className)} {...rest} />
  },
)

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <select ref={ref} className={cx('control', className)} {...rest}>
      {children}
    </select>
  )
})

export function Checkbox({
  label,
  hint,
  className,
  ...rest
}: { label: ReactNode; hint?: ReactNode } & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const id = useId()
  return (
    <div className={cx('flex items-start gap-3', className)}>
      <input id={id} type="checkbox" aria-describedby={hint ? `${id}-hint` : undefined} {...rest} />
      <label htmlFor={id} className="text-small leading-relaxed text-ink">
        {label}
        {hint ? (
          <span id={`${id}-hint`} className="mt-0.5 block text-ink-muted">
            {hint}
          </span>
        ) : null}
      </label>
    </div>
  )
}

export function RadioGroup<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
  error,
  className,
}: {
  legend: ReactNode
  name: string
  value: T | null
  options: Array<{ value: T; label: ReactNode }>
  onChange: (value: T) => void
  error?: string | null
  className?: string
}) {
  const id = useId()
  return (
    <fieldset className={cx('flex flex-col gap-2', className)} aria-describedby={error ? `${id}-error` : undefined}>
      <legend className="mb-1 text-small font-semibold text-ink">{legend}</legend>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {options.map((o) => (
          <label key={o.value} className="flex min-h-11 cursor-pointer items-center gap-2.5 text-small">
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="mt-0"
            />
            {o.label}
          </label>
        ))}
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-small font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  )
}
