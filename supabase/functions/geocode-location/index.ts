import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { city, state, location_address, postcode, country } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ latitude: null, longitude: null, error: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build location description from available fields
    const parts = [city, state, location_address, postcode, country].filter(Boolean);
    if (parts.length === 0) {
      return new Response(
        JSON.stringify({ latitude: null, longitude: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const locationDescription = parts.join(", ");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "You are a geocoding assistant. Given location details in Malaysia, return the latitude and longitude of the most likely location. If you cannot determine the location, call the function with latitude 0 and longitude 0.",
          },
          {
            role: "user",
            content: `Return the coordinates for this location in Malaysia: ${locationDescription}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_coordinates",
              description: "Return the latitude and longitude for the given location.",
              parameters: {
                type: "object",
                properties: {
                  latitude: { type: "number", description: "Latitude of the location" },
                  longitude: { type: "number", description: "Longitude of the location" },
                },
                required: ["latitude", "longitude"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_coordinates" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const body = await response.text();
      console.error("AI gateway error:", status, body);

      if (status === 429) {
        return new Response(
          JSON.stringify({ latitude: null, longitude: null, error: "rate_limited" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ latitude: null, longitude: null, error: "payment_required" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ latitude: null, longitude: null, error: "ai_error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (toolCall?.function?.arguments) {
      const args = JSON.parse(toolCall.function.arguments);
      const lat = args.latitude;
      const lng = args.longitude;

      // Validate: 0,0 means unresolvable; Malaysia roughly 1-7 lat, 100-119 lng
      if (lat && lng && lat !== 0 && lng !== 0) {
        return new Response(
          JSON.stringify({ latitude: lat, longitude: lng }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ latitude: null, longitude: null }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("geocode-location error:", e);
    return new Response(
      JSON.stringify({ latitude: null, longitude: null, error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
