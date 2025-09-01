/**
 * @file src/core/transport.ts
 * @description Runtime-aware transport to send payloads to Treblle (Edge-safe)
 */

export interface SendOptions {
  endpoint: string;
  sdkToken: string;
  payload: any;
  debug?: boolean;
  debugVerbose?: boolean;
  timeoutMs?: number;
}

function isEdgeRuntime(): boolean {
  return (
    typeof (globalThis as any).EdgeRuntime !== 'undefined' ||
    typeof process === 'undefined' ||
    typeof (process as any).hrtime !== 'function'
  );
}

function truncate(str: string, max = 8000): string {
  if (str.length <= max) return str;
  return str.slice(0, max) + `\n...[truncated ${str.length - max} chars]`;
}

export async function sendToTreblle({ endpoint, sdkToken, payload, debug, debugVerbose, timeoutMs = 5000 }: SendOptions): Promise<void> {
  // Prefer fetch in Edge runtimes
  if (isEdgeRuntime()) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      if (debugVerbose) {
        // eslint-disable-next-line no-console
        console.log('==== DEBUG: TREBLLE ENDPOINT ====' );
        // eslint-disable-next-line no-console
        console.log(`Sending to: ${endpoint}`);
        // eslint-disable-next-line no-console
        console.log('================================');

        // eslint-disable-next-line no-console
        console.log('\n==== DEBUG: TREBLLE PAYLOAD ====');
        const preview = truncate(JSON.stringify(payload, null, 2));
        // eslint-disable-next-line no-console
        console.log(preview);
        // eslint-disable-next-line no-console
        console.log('================================\n');
      }
      await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': sdkToken,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      }).then(async (res) => {
        if (debugVerbose) {
          let body = '';
          try { body = await res.text(); } catch { body = ''; }
          // eslint-disable-next-line no-console
          console.log('\n==== DEBUG: TREBLLE RESPONSE ====');
          // eslint-disable-next-line no-console
          console.log(`Status: ${res.status} ${res.statusText}`);
          if (body) {
            // eslint-disable-next-line no-console
            console.log(`Response: ${truncate(body)}`);
          }
          // eslint-disable-next-line no-console
          console.log('================================');
        }
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
    // Use require for sync load and Jest mocks compatibility (Node only)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const https = require('https');

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
        let chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => { if (debugVerbose) chunks.push(c); });
        res.on('end', () => {
          if (debugVerbose) {
            const body = Buffer.concat(chunks).toString('utf8');
            // eslint-disable-next-line no-console
            console.log('\n==== DEBUG: TREBLLE RESPONSE ====');
            // eslint-disable-next-line no-console
            console.log(`Status: ${res.statusCode}`);
            if (body) {
              // eslint-disable-next-line no-console
              console.log(`Response: ${truncate(body)}`);
            }
            // eslint-disable-next-line no-console
            console.log('================================');
          }
          resolve();
        });
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
