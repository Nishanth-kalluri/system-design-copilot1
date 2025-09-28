export function sseHeaders(): Headers {
  const headers = new Headers()
  headers.set('Content-Type', 'text/event-stream')
  headers.set('Cache-Control', 'no-cache')
  headers.set('Connection', 'keep-alive')
  headers.set('Access-Control-Allow-Origin', '*')
  return headers
}

export function sseFormat(event: string, data: any): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export class SSEEmitter {
  private controller: ReadableStreamDefaultController | null = null
  private heartbeatInterval: NodeJS.Timeout | null = null
  public connectionId?: string

  setController(controller: ReadableStreamDefaultController) {
    this.controller = controller
    
    // Start heartbeat
    const heartbeatMs = parseInt(process.env.SSE_HEARTBEAT_MS || '15000')
    this.heartbeatInterval = setInterval(() => {
      this.emit('heartbeat', { timestamp: Date.now() })
    }, heartbeatMs)
  }

  emit(event: string, data: any) {
    if (this.controller) {
      try {
        const formatted = sseFormat(event, data)
        this.controller.enqueue(new TextEncoder().encode(formatted))
        return true
      } catch (error) {
        console.error('SSE emit error:', error)
        return false
      }
    }
    return false
  }

  isActive(): boolean {
    return this.controller !== null
  }

  close() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
    
    if (this.controller) {
      try {
        this.controller.close()
      } catch (e) {
        // Controller might already be closed
      }
    }
  }
}

// In-memory store for SSE connections
export const sseStore = new Map<string, SSEEmitter>()

// Broadcast message to all active emitters for a runId (handles multiple tabs/connections)
export function broadcastMessage(runId: string, event: string, data: any): boolean {
  let sent = false
  sseStore.forEach((emitter, key) => {
    if (key.startsWith(runId) && emitter.isActive()) {
      const success = emitter.emit(event, data)
      if (success) sent = true
    }
  })
  return sent
}