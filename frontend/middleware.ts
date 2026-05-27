/**
 * Next.js Middleware — runtime proxy for /api/* → backend.
 *
 * Unlike next.config.js rewrites (which are evaluated at build time),
 * middleware runs on every matching request, so BACKEND_URL is read
 * from the live environment — not baked in during `next build`.
 */
import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: "/api/:path*",
};

export default async function middleware(req: NextRequest) {
  const backendUrl = process.env.BACKEND_URL ?? "http://omi-ted-v22-production.up.railway.app:8080";

  // Reconstruct the full target URL, preserving path and query string
  const incoming = req.nextUrl;
  const target = `${backendUrl}${incoming.pathname}${incoming.search}`;

  const headers = new Headers(req.headers);
  headers.delete("host");

  try {
    const backendRes = await fetch(target, {
      method: req.method,
      headers,
      body: ["GET", "HEAD"].includes(req.method) ? undefined : req.body,
      // @ts-expect-error — duplex required by Node 18 fetch for streaming bodies
      duplex: "half",
    });

    const resHeaders = new Headers(backendRes.headers);
    resHeaders.delete("content-encoding");
    resHeaders.delete("transfer-encoding");

    return new NextResponse(backendRes.body, {
      status: backendRes.status,
      statusText: backendRes.statusText,
      headers: resHeaders,
    });
  } catch (err) {
    console.error(`[middleware] Backend unreachable at ${target}:`, err);
    return NextResponse.json(
      { error: "Backend unreachable", target },
      { status: 502 }
    );
  }
}
