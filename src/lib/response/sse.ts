export function responseSSEOnce(payload: unknown): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const frame = `data: ${JSON.stringify(payload)}\n\n`;
      controller.enqueue(encoder.encode(frame));
      controller.close();
    },
  });
  const headers = new Headers({
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache",
    "connection": "keep-alive",
  });
  return new Response(stream, { status: 200, headers });
}
