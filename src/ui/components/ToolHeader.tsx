import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { IconButton } from './Button'

export function ToolHeader({ title, subtitle, onBack, children }: { title: string; subtitle?: string; onBack: () => void; children?: ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      <header className="flex items-center gap-2 border-b border-line bg-surface p-3 pt-[max(12px,env(safe-area-inset-top))] lg:px-6 lg:py-4">
        <IconButton label="Retour" onClick={onBack} className="-ml-1 lg:hidden">
          <ArrowLeft className="size-5" aria-hidden />
        </IconButton>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold">{title}</h1>
          {subtitle ? <p className="truncate text-sm text-fg-muted">{subtitle}</p> : null}
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[max(24px,env(safe-area-inset-bottom))] lg:px-6 lg:py-6">
        <div className="max-w-2xl">{children}</div>
      </div>
    </div>
  )
}
