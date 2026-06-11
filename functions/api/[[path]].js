/**
 * Proxies /api/* to API_ORIGIN when configured.
 * Without API_ORIGIN, requests fall through so the frontend can use offline simulation.
 */
export async function onRequest(context) {
  const apiOrigin = context.env.API_ORIGIN?.replace(/\/$/, "");

  if (!apiOrigin) {
    return Response.json(
      {
        error: "API_NOT_CONFIGURED",
        message:
          "No backend API is configured for this deployment. Using client-side simulation.",
      },
      { status: 200 },
    );
  }

  const requestUrl = new URL(context.request.url);
  const targetUrl = `${apiOrigin}${requestUrl.pathname}${requestUrl.search}`;

  const headers = new Headers(context.request.headers);
  headers.delete("host");

  // Add backend API key for authentication
  if (context.env.API_KEY) {
    headers.set("Authorization", `Bearer ${context.env.API_KEY}`);
  }

  const init = {
    method: context.request.method,
    headers,
    redirect: "manual",
  };

  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    init.body = context.request.body;
  }

  try {
    const response = await fetch(targetUrl, init);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error) {
    return Response.json(
      {
        error: "API_PROXY_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Failed to reach backend API",
      },
      { status: 502 },
    );
  }
}
