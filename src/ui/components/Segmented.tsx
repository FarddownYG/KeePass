interface SegmentedProps<T extends string> {
  label: string
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
}

export function Segmented<T extends string>({ label, value, onChange, options }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-line-strong bg-sunken p-0.5">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`h-10 rounded-sm px-4 text-base font-medium transition-colors duration-150 lg:h-8 lg:text-sm ${
              active ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted hover:text-fg'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
