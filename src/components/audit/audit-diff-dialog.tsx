'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { ChevronRight, ChevronDown } from 'lucide-react'

type AuditEntry = {
  id: string
  action: string
  entity: string
  entityId?: string | null
  before?: string | null
  after?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  result: string
  createdAt: string
  user?: { firstName: string | null; lastName: string | null; username: string } | null
}

export function AuditDiffDialog({ entry, open, onOpenChange }: {
  entry: AuditEntry | null
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [showBefore, setShowBefore] = useState(true)
  const [showAfter, setShowAfter] = useState(true)

  if (!entry) return null

  const beforeData = entry.before ? safeParse(entry.before) : null
  const afterData = entry.after ? safeParse(entry.after) : null

  // Calcular diffs
  const changes = diffObjects(beforeData, afterData)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Badge variant="secondary">{entry.action}</Badge>
            <span className="text-slate-600">{entry.entity}</span>
          </DialogTitle>
          <p className="text-xs text-slate-500">
            {entry.user ? `${entry.user.firstName || entry.user.username}` : 'Sistema'} ·
            {' '}{new Date(entry.createdAt).toLocaleString('es-CU')}
            {entry.ipAddress && ` · IP: ${entry.ipAddress}`}
          </p>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-3">
            {/* Resumen de cambios */}
            {changes.length > 0 && (
              <div className="rounded-lg border p-3 bg-slate-50 dark:bg-slate-900">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">
                  Cambios detectados ({changes.length})
                </p>
                <div className="space-y-1">
                  {changes.map((change, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="font-mono text-xs bg-slate-200 dark:bg-slate-800 px-1.5 rounded">
                        {change.field}
                      </span>
                      {change.old !== undefined && (
                        <span className="text-red-600 line-through text-xs">
                          {formatValue(change.old)}
                        </span>
                      )}
                      {change.old !== undefined && change.new !== undefined && (
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                      )}
                      {change.new !== undefined && (
                        <span className="text-emerald-600 font-medium text-xs">
                          {formatValue(change.new)}
                        </span>
                      )}
                      {change.old === undefined && change.new !== undefined && (
                        <Badge className="text-[10px] bg-emerald-100 text-emerald-800">Nuevo</Badge>
                      )}
                      {change.old !== undefined && change.new === undefined && (
                        <Badge className="text-[10px] bg-red-100 text-red-800">Eliminado</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Antes y Después expandibles */}
            <div className="space-y-2">
              {beforeData && (
                <div className="rounded-lg border">
                  <button
                    className="w-full flex items-center justify-between p-2 text-xs font-medium"
                    onClick={() => setShowBefore(!showBefore)}
                  >
                    <span className="text-red-600">Antes</span>
                    {showBefore ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  </button>
                  {showBefore && (
                    <pre className="text-xs p-2 bg-red-50 dark:bg-red-950/20 overflow-x-auto rounded-b-lg">
                      {JSON.stringify(beforeData, null, 2)}
                    </pre>
                  )}
                </div>
              )}
              {afterData && (
                <div className="rounded-lg border">
                  <button
                    className="w-full flex items-center justify-between p-2 text-xs font-medium"
                    onClick={() => setShowAfter(!showAfter)}
                  >
                    <span className="text-emerald-600">Después</span>
                    {showAfter ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  </button>
                  {showAfter && (
                    <pre className="text-xs p-2 bg-emerald-50 dark:bg-emerald-950/20 overflow-x-auto rounded-b-lg">
                      {JSON.stringify(afterData, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>

            {!beforeData && !afterData && (
              <p className="text-sm text-slate-500 text-center py-4">
                No hay datos de cambios registrados
              </p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

function safeParse(str: string): any {
  try { return JSON.parse(str) } catch { return str }
}

function formatValue(v: any): string {
  if (v === null) return 'null'
  if (v === undefined) return 'undefined'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function diffObjects(before: any, after: any): { field: string; old: any; new: any }[] {
  if (!before && !after) return []
  if (!before) before = {}
  if (!after) after = {}
  if (typeof before !== 'object' || typeof after !== 'object') {
    return [{ field: 'valor', old: before, new: after }]
  }

  const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})])
  const changes: { field: string; old: any; new: any }[] = []

  for (const key of allKeys) {
    const oldVal = before[key]
    const newVal = after[key]
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push({ field: key, old: oldVal, new: newVal })
    }
  }

  return changes
}
