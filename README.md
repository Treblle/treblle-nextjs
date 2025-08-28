# Treblle - API Intelligence Platform

[![Treblle API Intelligence](https://github.com/user-attachments/assets/b268ae9e-7c8a-4ade-95da-b4ac6fce6eea)](https://treblle.com)

[Website](http://treblle.com/) • [Documentation](https://docs.treblle.com/) • [Pricing](https://treblle.com/pricing)

Treblle is an API intelligence platfom that helps developers, teams and organizations understand their APIs from a single integration point.

---

## Treblle Next.js SDK

Treblle Next.js SDK that supports Pages Router (`pages/api`) and App Router (`app/api`) supported

## Requirements
 
- Node.js: Follows your Next.js version requirements (Node 18+ recommended)
- Runtimes: Node.js and Edge (see Edge notes)

## Installation

```bash
npm install @treblle/next
# or
pnpm add @treblle/next
# or
yarn add @treblle/next
```

Keep keys server-only. Do not expose with `NEXT_PUBLIC_`.

## Get Your Keys

1. Create a free account: https://treblle.com
2. Create a project to get:
   - `sdkToken`
   - `apiKey`
3. Add to your `.env` (server-only):

```env
TREBLLE_SDK_TOKEN=your_sdk_token
TREBLLE_API_KEY=your_api_key
```

## Quick Start

Pick your routing setup:

- Pages Router: wrap `pages/api/*` handlers
- App Router: wrap `app/api/*` route method exports
- Middleware (optional): observe all requests at the edge (with body limits)

### Pages Router (pages/api)

`pages/api/users.ts`

```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { nextTreblle } from '@treblle/next';

const treblle = nextTreblle({
  sdkToken: process.env.TREBLLE_SDK_TOKEN!,
  apiKey: process.env.TREBLLE_API_KEY!,
  // debug: process.env.NODE_ENV !== 'production',
});

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') return res.status(200).json({ users: [] });
  return res.status(405).json({ error: 'Method not allowed' });
}

export default treblle(handler);
```

JavaScript version:

```js
import { nextTreblle } from '@treblle/next';

const treblle = nextTreblle({
  sdkToken: process.env.TREBLLE_SDK_TOKEN,
  apiKey: process.env.TREBLLE_API_KEY,
});

async function handler(req, res) {
  if (req.method === 'GET') return res.status(200).json({ users: [] });
  return res.status(405).json({ error: 'Method not allowed' });
}

export default treblle(handler);
```

### App Router (app/api)

`app/api/users/route.ts`

```ts
import { NextResponse } from 'next/server';
import { nextTreblle } from '@treblle/next';

const treblle = nextTreblle({
  sdkToken: process.env.TREBLLE_SDK_TOKEN!,
  apiKey: process.env.TREBLLE_API_KEY!,
  // debug: process.env.NODE_ENV !== 'production',
});

export const GET = treblle(async () => {
  return NextResponse.json({ users: [] });
});

export const POST = treblle(async (req: Request) => {
  const body = await req.json();
  return NextResponse.json({ success: true, user: body }, { status: 201 });
});

// To run on Edge (optional):
// export const runtime = 'edge';
```

### Optional: Global Middleware (Edge)

Use only if you want coarse-grained visibility on every request. Middleware can’t read bodies for non‑GET methods, so wrap API handlers for full detail.

```ts
// middleware.ts
import { NextResponse } from 'next/server';
import { nextMiddlewareTreblle } from '@treblle/next';

const treblle = nextMiddlewareTreblle({
  sdkToken: process.env.TREBLLE_SDK_TOKEN!,
  apiKey: process.env.TREBLLE_API_KEY!,
  // blocklistPaths: [/^\/_next\//, 'static', 'images'],
});

export default treblle(async () => NextResponse.next());

// Limit to API routes (optional):
// export const config = { matcher: ['/api/:path*'] };
```

## Configuration

Pass these options to `nextTreblle` or `nextMiddlewareTreblle`:

- `sdkToken`: Your Treblle SDK token (required)
- `apiKey`: Your Treblle API key (required)
- `additionalFieldsToMask`: Extra field names to mask (string[])
- `blocklistPaths`: Paths to exclude (string prefixes or a RegExp)
- `ignoreDefaultBlockedPaths`: Disable default static/noise filters (boolean; default `false`)
- `debug`: Print Treblle errors to console (boolean; default `false`)

Example:

```ts
const treblle = nextTreblle({
  sdkToken: process.env.TREBLLE_SDK_TOKEN!,
  apiKey: process.env.TREBLLE_API_KEY!,
  additionalFieldsToMask: ['customSecret', 'internalId'],
  blocklistPaths: ['admin', /^\/api\/v1\/internal/],
  ignoreDefaultBlockedPaths: false,
  debug: process.env.NODE_ENV !== 'production',
});
```

Production-only enablement:

```ts
const maybeTreblle = process.env.NODE_ENV === 'production'
  ? nextTreblle({ sdkToken: process.env.TREBLLE_SDK_TOKEN!, apiKey: process.env.TREBLLE_API_KEY! })
  : ((h: any) => h); // no-op passthrough

export const GET = maybeTreblle(async () => NextResponse.json({ ok: true }));
```

## Defaults

### Masked Fields

Automatically masked in request/response bodies:

- `password`, `pwd`, `secret`, `password_confirmation`, `passwordConfirmation`
- `cc`, `card_number`, `cardNumber`, `ccv`
- `ssn`
- `credit_score`, `creditScore`

Add more via `additionalFieldsToMask`.

### Blocked Paths

Ignored by default to reduce noise:

- Files: `favicon.ico`, `robots.txt`, `sitemap.xml`, `manifest.json`, `sw.js`, `service-worker.js`, `browserconfig.xml`, `crossdomain.xml`, `ads.txt`, `apple-touch-icon*`
- Directories: `/.well-known/`, `/static/`, `/assets/`, `/public/`, `/images/`, `/css/`, `/js`
- Extensions: `.css`, `.js`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.ico`, `.woff`, `.woff2`, `.ttf`, `.eot`

Override example:

```ts
ignoreDefaultBlockedPaths: true,
blocklistPaths: ['favicon.ico'],
```

## Edge Notes

- App Router handlers can opt into Edge with `export const runtime = 'edge'`
- Middleware runs at the edge; bodies of non‑GET requests are not readable there
- Prefer wrapping route handlers for full body and error detail

## API Reference

- `nextTreblle(config) -> (handler) => wrappedHandler`
  - Wraps Next.js API handlers (Pages) and route method handlers (App Router)
  - Works in Node and Edge (per handler runtime)

- `nextMiddlewareTreblle(config) -> (mw) => wrappedMiddleware`
  - Wraps `middleware.ts` for coarse-grained, global observation (Edge)

Config type (informal):

```ts
type NextTreblleConfig = {
  sdkToken: string;
  apiKey: string;
  additionalFieldsToMask?: string[];
  blocklistPaths?: (string | RegExp)[];
  ignoreDefaultBlockedPaths?: boolean;
  debug?: boolean;
};
```

## Troubleshooting

- Enable logs: set `debug: true` and check server output
- Verify keys: `sdkToken` and `apiKey` from your Treblle dashboard
- Start simple: add a `GET /api/health` and hit it
- Check blocking: ensure your route isn’t blocked by defaults or `blocklistPaths`
- Edge body missing: use handler wrapping instead of middleware for body capture

## Security Notes

- Store keys in server-only env vars; never use `NEXT_PUBLIC_*`
- Avoid logging secrets; use `additionalFieldsToMask` for custom sensitive fields


## License

MIT © Treblle Inc.

---

### Copy‑Paste Templates

Pages Router:

```ts
// pages/api/hello.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { nextTreblle } from '@treblle/next';

const treblle = nextTreblle({
  sdkToken: process.env.TREBLLE_SDK_TOKEN!,
  apiKey: process.env.TREBLLE_API_KEY!,
});

async function handler(req: NextApiRequest, res: NextApiResponse) {
  return res.status(200).json({ ok: true });
}

export default treblle(handler);
```

App Router:

```ts
// app/api/hello/route.ts
import { NextResponse } from 'next/server';
import { nextTreblle } from '@treblle/next';

const treblle = nextTreblle({
  sdkToken: process.env.TREBLLE_SDK_TOKEN!,
  apiKey: process.env.TREBLLE_API_KEY!,
});

export const GET = treblle(async () => NextResponse.json({ ok: true }));
```

Middleware (optional):

```ts
// middleware.ts
import { NextResponse } from 'next/server';
import { nextMiddlewareTreblle } from '@treblle/next';

const treblle = nextMiddlewareTreblle({
  sdkToken: process.env.TREBLLE_SDK_TOKEN!,
  apiKey: process.env.TREBLLE_API_KEY!,
});

export default treblle(async () => NextResponse.next());
// export const config = { matcher: ['/api/:path*'] };
```