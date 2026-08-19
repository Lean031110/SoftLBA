'use client'

// Hook para generar un beep con Web Audio API
//
// FRONTEND-02A (fix #5): cleanup de AudioContext al desmontar.
// Antes: el AudioContext se creaba pero nunca se cerraba → memory leak
// (browsers cap en ~6 contextos activos simultáneos).
import { useCallback, useEffect, useRef } from 'react'

export function useBeep() {
  const ctxRef = useRef<AudioContext | null>(null)

  // Cleanup al desmontar: cerrar el AudioContext para liberar recursos.
  useEffect(() => {
    return () => {
      if (ctxRef.current) {
        try {
          ctxRef.current.close()
        } catch {
          // Silencioso si ya estaba cerrado
        }
        ctxRef.current = null
      }
    }
  }, [])

  const play = useCallback((frequency = 880, duration = 200, volume = 0.3) => {
    try {
      if (!ctxRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
        if (!AudioCtx) return
        ctxRef.current = new AudioCtx()
      }
      const ctx = ctxRef.current
      if (ctx.state === 'suspended') ctx.resume()

      // Tres pitidos cortos para máximo impacto
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = frequency
      gain.gain.setValueAtTime(0, now)
      // primer pitido
      gain.gain.linearRampToValueAtTime(volume, now + 0.05)
      gain.gain.linearRampToValueAtTime(0, now + 0.2)
      // segundo
      gain.gain.linearRampToValueAtTime(volume, now + 0.3)
      gain.gain.linearRampToValueAtTime(0, now + 0.45)
      // tercero
      gain.gain.linearRampToValueAtTime(volume, now + 0.55)
      gain.gain.linearRampToValueAtTime(0, now + 0.7)

      osc.start(now)
      osc.stop(now + duration / 1000 + 0.7)
    } catch {
      // Silencioso si el navegador bloquea
    }
  }, [])

  return { play }
}
