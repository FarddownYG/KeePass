import { SessionProvider } from './ui/state/SessionProvider'
import { useSession } from './ui/state/session-context'
import { ToastProvider } from './ui/state/ToastProvider'
import { Main } from './ui/screens/Main'
import { Welcome } from './ui/screens/Welcome'

function Gate() {
  const { db } = useSession()
  return db ? <Main /> : <Welcome />
}

export default function App() {
  return (
    <ToastProvider>
      <SessionProvider>
        <Gate />
      </SessionProvider>
    </ToastProvider>
  )
}
