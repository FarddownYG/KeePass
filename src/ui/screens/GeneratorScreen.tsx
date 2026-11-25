import { GeneratorPanel } from '../components/GeneratorPanel'
import { ToolHeader } from '../components/ToolHeader'

export function GeneratorScreen({ onBack }: { onBack: () => void }) {
  return (
    <ToolHeader title="Générateur" subtitle="Créez un mot de passe ou une phrase de passe aléatoire." onBack={onBack}>
      <div className="rounded-lg border border-line bg-surface p-4 lg:p-6">
        <GeneratorPanel />
      </div>
    </ToolHeader>
  )
}
