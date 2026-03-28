// netlify/edge-functions/listings.js
// Proxies Auto.dev API requests, hiding the API key server-side.
// Set AUTO_DEV_API_KEY in Netlify environment variables.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const apiKey = Deno.env.get("AUTO_DEV_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "API key not configured" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const url = new URL(request.url);
  const params = url.searchParams;

  // Build Auto.dev URL, forwarding all query params
  const apiUrl = new URL("https://api.auto.dev/listings");
  for (const [key, value] of params.entries()) {
    apiUrl.searchParams.set(key, value);
  }
  apiUrl.searchParams.set("apiKey", apiKey);

  try {
    const res = await fetch(apiUrl.toString(), {
      headers: { "Content-Type": "application/json" },
    });

    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 502,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
};

export const config = { path: "/api/listings" };
