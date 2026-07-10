import { subscribeParty } from '$lib/server/parties.js';

export function GET({ params }) {
  /** @type {ReturnType<typeof setInterval> | null} */
  let keepAliveId = null;
  /** @type {(() => void) | null} */
  let unsubscribe = null;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      /**
       * @param {string} event
       * @param {unknown} data
       */
      const send = (event, data) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      const subscription = subscribeParty(params.code, (party) => {
        send('party', { party });
      });

      if ('error' in subscription) {
        send('error', { message: subscription.error });
        controller.close();
        return;
      }

      unsubscribe = subscription.unsubscribe;
      keepAliveId = setInterval(() => {
        controller.enqueue(encoder.encode(': keep-alive\n\n'));
      }, 25000);
    },
    cancel() {
      if (keepAliveId) {
        clearInterval(keepAliveId);
      }

      unsubscribe?.();
    }
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive'
    }
  });
}