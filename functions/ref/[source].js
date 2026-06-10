/**
 * /ref/[source] — Referrer tracking redirect
 *
 * How it works:
 *   1. Returns a minimal HTML page so Cloudflare's auto-injected Web Analytics
 *      beacon fires and records a page view for /ref/<source>.
 *   2. A fast JS redirect (+ meta fallback) sends the visitor to the homepage.
 *
 * Usage:
 *   LinkedIn profile  → https://yoursite.com/ref/linkedin
 *   Résumé / CV       → https://yoursite.com/ref/resume
 *   GitHub profile    → https://yoursite.com/ref/github
 *   Any other source  → https://yoursite.com/ref/<anything>
 *
 * Viewing data:
 *   Cloudflare Dashboard → Web Analytics → Top Pages
 *   Filter or look for paths starting with /ref/ to see click counts per source.
 */
export async function onRequest(context) {
  const source = context.params.source ?? "unknown";
  const destination = "/";

  // Allowed sources whitelist — rejects typos/abuse with a 404
  const allowed = ["linkedin", "resume", "github", "twitter", "x", "email", "direct"];
  if (!allowed.includes(source.toLowerCase())) {
    return new Response("Not found", { status: 404 });
  }

  // Return an HTML page so CF Web Analytics beacon fires before the redirect.
  // The beacon is auto-injected by Cloudflare into every HTML response when
  // RUM is enabled — we don't need to add the script tag manually.
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="refresh" content="0;url=${destination}" />
    <title>Redirecting…</title>
    <style>
      body { margin: 0; background: #020617; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
      p { font-family: system-ui, sans-serif; color: #94a3b8; font-size: 0.9rem; }
    </style>
  </head>
  <body>
    <p>Redirecting…</p>
    <script>
      // Fast JS redirect — meta refresh above is the fallback
      window.location.replace("${destination}");
    </script>
  </body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html;charset=UTF-8",
      // Don't cache these pages — each hit should be a fresh analytics event
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
