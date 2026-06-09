'use client'

import { createContext, useContext, useState } from 'react'

interface SidebarContextType {
  open:      boolean
  collapsed: boolean
  toggleOpen:    () => void
  toggleCollapsed: () => void
  closeDrawer:   () => void
}

const SidebarContext = createContext<SidebarContextType>({
  open: false, collapsed: false,
  toggleOpen: () => {}, toggleCollapsed: () => {}, closeDrawer: () => {},
})

export function useSidebar() {
  return useContext(SidebarContext)
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [open,      setOpen]      = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  return (
    <SidebarContext.Provider value={{
      open,
      collapsed,
      toggleOpen:      () => setOpen(v => !v),
      toggleCollapsed: () => setCollapsed(v => !v),
      closeDrawer:     () => setOpen(false),
    }}>
      {children}
    </SidebarContext.Provider>
  )
}
