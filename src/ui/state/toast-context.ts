import { createContext, useContext } from 'react'

export type ToastKind = 'info' | 'error'

export interface ToastApi {
  toast: (message: string, kind?: ToastKind) => void
}

export const ToastContext = createContext<ToastApi>({ toast: () => undefined })

export function useToast(): ToastApi['toast'] {
  return useContext(ToastContext).toast
}
