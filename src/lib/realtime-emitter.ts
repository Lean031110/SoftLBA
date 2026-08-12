// ============================================================
// Realtime Emitter - Emite eventos desde el servidor al servicio Socket.IO
// ============================================================
// En lugar de que el cliente emita eventos, el servidor los emite
// después de confirmar cada acción.
// ============================================================

const REALTIME_URL = 'http://localhost:3003'

export async function emitToRoom(room: string, event: string, data: any): Promise<void> {
  try {
    await fetch(`${REALTIME_URL}/emit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room, event, data }),
    })
  } catch (e) {
    console.error('[realtime-emitter] Error:', e)
  }
}

export async function emitToUser(userId: string, event: string, data: any): Promise<void> {
  await emitToRoom(`user:${userId}`, event, data)
}

export async function emitToRole(role: string, event: string, data: any): Promise<void> {
  await emitToRoom(`role:${role}`, event, data)
}

export async function emitToArea(areaId: string, event: string, data: any): Promise<void> {
  await emitToRoom(`area:${areaId}`, event, data)
}

export async function broadcast(event: string, data: any): Promise<void> {
  await emitToRoom('broadcast', event, data)
}
