'use client'

import { useEffect } from 'react'

function showUpdateToast() {
  const toast = document.createElement('div')
  toast.textContent = 'Nova versão disponível, atualizando...'
  toast.style.cssText =
    'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);' +
    'background:#111827;color:#fff;padding:10px 16px;border-radius:8px;' +
    'font:14px/1.4 system-ui,sans-serif;z-index:2147483647;box-shadow:0 2px 8px rgba(0,0,0,.25)'
  document.body.appendChild(toast)
}

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    let reloading = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return
      reloading = true
      showUpdateToast()
      window.location.reload()
    })

    navigator.serviceWorker.register('/sw.js').then((registration) => {
      // Catch updates already waiting from a previous session.
      if (registration.waiting && navigator.serviceWorker.controller) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      }

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        newWorker?.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            newWorker.postMessage({ type: 'SKIP_WAITING' })
          }
        })
      })

      // Ask the browser to re-check for a new SW whenever the app regains focus,
      // since installed PWAs can stay open for days without a natural navigation.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          registration.update().catch(() => {})
        }
      })
    }).catch(() => {})
  }, [])

  return null
}
