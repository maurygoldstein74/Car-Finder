// netlify/edge-functions/listings.js
// Proxies Auto.dev listings, photos, and Claude trim lookups.
// Env vars: AUTO_DEV_API_KEY, ANTHROPIC_API_KEY

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const JSON_HDR = { ...CORS, "Content-Type": "application/json" };

export default async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const url = new URL(request.url);
  const path = url.pathname;

  try {
    // ── /api/trims — Claude-powered trim lookup ──
    if (path === "/api/trims") {
      const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (!anthropicKey) {
        return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), { status: 500, headers: JSON_HDR });
      }

      const make = url.searchParams.get("make") || "";
      const model = url.searchParams.get("model") || "";
      const yearMin = url.searchParams.get("yearMin") || "";
      const yearMax = url.searchParams.get("yearMax") || "";

      const prompt = `List every trim level available for the ${yearMin}${yearMax && yearMax !== yearMin ? "-" + yearMax : ""} ${make} ${model} sold in the United States. Include all sub-trims and special editions. Return ONLY a JSON array of strings, no other text. Example: ["SR","SR5","TRD Sport","TRD Off-Road","Limited","TRD Pro"]. If you're not sure about a trim, include it anyway — better to over-include than miss one.`;

      const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const claudeJson = await claudeRes.json();
      const text = claudeJson?.content?.[0]?.text || "[]";

      // Extract JSON array from response
      const match = text.match(/\[[\s\S]*\]/);
      const trims = match ? JSON.parse(match[0]) : [];

      return new Response(JSON.stringify({ trims, raw: text }), { status: 200, headers: JSON_HDR });
    }

    // ── /api/photo/{vin} — Photo lookup ──
    if (path.startsWith("/api/photo/")) {
      const apiKey = Deno.env.get("AUTO_DEV_API_KEY");
      if (!apiKey) return new Response(JSON.stringify({ error: "AUTO_DEV_API_KEY not configured" }), { status: 500, headers: JSON_HDR });

      const vin = path.replace("/api/photo/", "");
      const res = await fetch(`https://api.auto.dev/photos/${vin}?apiKey=${apiKey}`);
      const body = await res.text();
      return new Response(body, { status: res.status, headers: JSON_HDR });
    }

    // ── /api/listings — Auto.dev proxy ──
    if (path === "/api/listings") {
      const apiKey = Deno.env.get("AUTO_DEV_API_KEY");
      if (!apiKey) return new Response(JSON.stringify({ error: "AUTO_DEV_API_KEY not configured" }), { status: 500, headers: JSON_HDR });

      const apiUrl = new URL("https://api.auto.dev/listings");
      for (const [key, value] of url.searchParams.entries()) {
        apiUrl.searchParams.set(key, value);
      }
      apiUrl.searchParams.set("apiKey", apiKey);

      const res = await fetch(apiUrl.toString(), { headers: { "Content-Type": "application/json" } });
      const body = await res.text();
      return new Response(body, { status: res.status, headers: JSON_HDR });
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: JSON_HDR });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 502, headers: JSON_HDR });
  }
};

export const config = { path: ["/api/listings", "/api/photo/*", "/api/trims"] };
