/**
 * @file src/core/transport.ts
 * @description Runtime-aware transport to send payloads to Treblle (Edge-safe)
 */

export interface SendOptions {
  endpoint: string;
  sdkToken: string;
  payload: any;
  debug?: boolean;
  timeoutMs?: number;
}

function isEdgeRuntime(): boolean {
  return (
    typeof (globalThis as any).EdgeRuntime !== 'undefined' ||
    typeof process === 'undefined' ||
    typeof (process as any).hrtime !== 'function'
  );
}

export async function sendToTreblle({ endpoint, sdkToken, payload, debug, timeoutMs = 5000 }: SendOptions): Promise<void> {
  // Prefer fetch in Edge runtimes
  if (isEdgeRuntime()) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': sdkToken,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (err: unknown) {
      if (debug) {
        // eslint-disable-next-line no-console
        console.error('[Treblle SDK] Edge transport error:', err);
      }
    } finally {
      clearTimeout(t);
    }
    return;
  }

  // Node runtime: use https via dynamic import to avoid top-level require in Edge
  try {
    const url = new URL(endpoint);
    const https = await import('https');

    const options: any = {
      method: 'POST',
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': sdkToken,
      },
    };

    await new Promise<void>((resolve) => {
      const req = https.request(options, (res: any) => {
        // Avoid logging in transport to prevent post-test console warnings
        // Drain and ignore
        res.on('data', () => {});
        res.on('end', () => resolve());
      });

      req.on('error', (_e: any) => resolve());
      req.setTimeout(timeoutMs, () => {
        try { req.destroy(); } catch {}
        resolve();
      });

      req.write(JSON.stringify(payload));
      req.end();
    });
  } catch (err: unknown) {
    if (debug) {
      // eslint-disable-next-line no-console
      console.error('[Treblle SDK] Node transport error:', err);
    }
  }
}
