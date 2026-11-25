import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  children?: ReactNode
  action?: ReactNode
}

export function EmptyState({ icon, title, children, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-start gap-3 px-6 py-10 text-fg-muted">
      <span className="text-fg-subtle">{icon}</span>
      <div>
        <h3 className="text-base font-semibold text-fg">{title}</h3>
        {children ? <p className="mt-1 max-w-sm text-sm">{children}</p> : null}
      </div>
      {action}
    </div>
  )
}
