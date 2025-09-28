// Simple polling-based message updates - much more reliable than SSE
export class MessagePoller {
  private intervalId: NodeJS.Timeout | null = null
  private isPolling = false
  private lastMessageCount = 0

  constructor(
    private runId: string,
    private onMessagesUpdate: (messages: any[]) => void,
    private onError: (error: Error) => void,
    private pollInterval: number = 2000 // 2 seconds
  ) {}

  start() {
    if (this.isPolling) return
    
    this.isPolling = true
    console.log('Starting message polling for runId:', this.runId)
    
    // Poll immediately, then at intervals
    this.poll()
    this.intervalId = setInterval(() => {
      this.poll()
    }, this.pollInterval)
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.isPolling = false
    console.log('Stopped message polling for runId:', this.runId)
  }

  private async poll() {
    try {
      const response = await fetch(`/api/runs/${this.runId}/messages`)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      const messages = data.messages || []
      
      // Only update if message count changed
      if (messages.length !== this.lastMessageCount) {
        console.log(`Message count changed: ${this.lastMessageCount} -> ${messages.length}`)
        this.lastMessageCount = messages.length
        
        // Apply MAX_MESSAGES limit (keep most recent)
        const MAX_MESSAGES = 500
        const limitedMessages = messages.length > MAX_MESSAGES 
          ? messages.slice(messages.length - MAX_MESSAGES) 
          : messages
          
        this.onMessagesUpdate(limitedMessages)
      }
    } catch (error) {
      console.error('Polling error:', error)
      this.onError(error as Error)
    }
  }

  // Force immediate poll (useful after sending a message)
  forceUpdate() {
    if (this.isPolling) {
      this.poll()
    }
  }
}