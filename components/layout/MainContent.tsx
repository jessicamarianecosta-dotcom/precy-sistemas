'use client'
import { useSidebar } from '@/providers/SidebarProvider'
import { clsx } from 'clsx'

export function MainContent({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar()
  return (
    <main
      className={clsx(
        'min-h-screen overflow-x-hidden transition-all duration-300',
        // Mobile: sem margem (sidebar é overlay)
        // Desktop: margem dinâmica conforme collapsed
        collapsed ? 'lg:ml-16' : 'lg:ml-60'
      )}
    >
      {children}
    </main>
  )
}
