// For large scenes & summaries we want to avoid creating one giant string buffer.
// This produces a simple text bundle (NOT a real ZIP) but does so as a stream so
// memory footprint stays low. Each part is encoded & enqueued sequentially.
export function createZipContent(scene: any, summary: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()

  return new ReadableStream<Uint8Array>({
    start(controller) {
      try {
        controller.enqueue(encoder.encode('// scene.json\n'))
        // Stream the scene JSON in chunks to avoid one huge JSON.stringify of massive objects.
        // However JSON.stringify is atomic; for now we still call it once but immediately enqueue and let GC reclaim.
        // If scenes become extremely large, replace with a streaming JSON serializer.
        const sceneJson = JSON.stringify(scene, null, 2)
        controller.enqueue(encoder.encode(sceneJson))
        controller.enqueue(encoder.encode('\n\n// summary.md\n'))
        controller.enqueue(encoder.encode(summary))
        controller.close()
      } catch (err) {
        controller.error(err)
      }
    },
  })
}