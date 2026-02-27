import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function getOrCreateVapidKeys() {
  // Check if keys exist
  const { data: existingKeys } = await supabaseAdmin
    .from("push_config")
    .select("key_name, key_value")
    .in("key_name", ["vapid_public_key", "vapid_private_key"]);

  if (existingKeys && existingKeys.length === 2) {
    const publicKey = existingKeys.find(
      (k) => k.key_name === "vapid_public_key"
    )?.key_value;
    const privateKey = existingKeys.find(
      (k) => k.key_name === "vapid_private_key"
    )?.key_value;
    return { publicKey, privateKey };
  }

  // Generate new VAPID keys
  const vapidKeys = webpush.generateVAPIDKeys();

  // Store them
  await supabaseAdmin.from("push_config").upsert([
    { key_name: "vapid_public_key", key_value: vapidKeys.publicKey },
    { key_name: "vapid_private_key", key_value: vapidKeys.privateKey },
  ]);

  return {
    publicKey: vapidKeys.publicKey,
    privateKey: vapidKeys.privateKey,
  };
}

async function handleGetVapidKey() {
  const keys = await getOrCreateVapidKeys();
  return new Response(JSON.stringify({ publicKey: keys.publicKey }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleSubscribe(
  req: Request,
  supabaseUser: ReturnType<typeof createClient>
) {
  const { subscription } = await req.json();

  const authHeader = req.headers.get("Authorization")!;
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } =
    await supabaseUser.auth.getClaims(token);

  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  const userId = claimsData.claims.sub;

  const { error } = await supabaseAdmin.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth_key: subscription.keys.auth,
    },
    { onConflict: "user_id,endpoint" }
  );

  if (error) {
    console.error("Error saving subscription:", error);
    return new Response(JSON.stringify({ error: "Failed to save" }), {
      status: 500,
      headers: corsHeaders,
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleUnsubscribe(
  req: Request,
  supabaseUser: ReturnType<typeof createClient>
) {
  const { endpoint } = await req.json();

  const authHeader = req.headers.get("Authorization")!;
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData } = await supabaseUser.auth.getClaims(token);

  if (!claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  const userId = claimsData.claims.sub;

  await supabaseAdmin
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("endpoint", endpoint);

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; tag?: string; url?: string }
) {
  const keys = await getOrCreateVapidKeys();

  webpush.setVapidDetails(
    "mailto:noreply@arb073.app",
    keys.publicKey!,
    keys.privateKey!
  );

  // Get all subscriptions for the user
  const { data: subscriptions } = await supabaseAdmin
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", userId);

  if (!subscriptions || subscriptions.length === 0) return;

  const pushPayload = JSON.stringify(payload);

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth_key,
          },
        },
        pushPayload
      );
    } catch (err: any) {
      console.error(`Push failed for ${sub.endpoint}:`, err.statusCode);
      // Remove expired/invalid subscriptions
      if (err.statusCode === 404 || err.statusCode === 410) {
        await supabaseAdmin
          .from("push_subscriptions")
          .delete()
          .eq("id", sub.id);
      }
    }
  }
}

async function handleCheckAndSend() {
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60000);

  // Find arbitrages starting in the next 5 minutes
  const { data: upcomingGames, error } = await supabaseAdmin
    .from("arbitrages")
    .select(
      "id, descricao, data_evento, casa_01_nome, casa_02_nome, casa_03_nome, user_id"
    )
    .eq("status", "aguardando")
    .gte("data_evento", now.toISOString())
    .lte("data_evento", fiveMinutesFromNow.toISOString());

  if (error) {
    console.error("Error fetching upcoming games:", error);
    return new Response(JSON.stringify({ error: "Failed to check games" }), {
      status: 500,
      headers: corsHeaders,
    });
  }

  if (!upcomingGames || upcomingGames.length === 0) {
    return new Response(
      JSON.stringify({ message: "No upcoming games", sent: 0 }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  let sentCount = 0;

  for (const game of upcomingGames) {
    // Check if already notified
    const { data: existing } = await supabaseAdmin
      .from("push_sent_log")
      .select("id")
      .eq("arbitrage_id", game.id)
      .eq("user_id", game.user_id)
      .maybeSingle();

    if (existing) continue;

    const eventTime = new Date(game.data_evento);
    const minutesUntil = Math.round(
      (eventTime.getTime() - now.getTime()) / 60000
    );

    const casas = [game.casa_01_nome, game.casa_02_nome, game.casa_03_nome]
      .filter(Boolean)
      .join(", ");
    const horario = eventTime.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });

    await sendPushToUser(game.user_id, {
      title: "🎯 Jogo Começando!",
      body: `${game.descricao}\n⏰ ${horario} (${minutesUntil}min)\n🏠 ${casas}`,
      tag: `game-${game.id}`,
      url: "/minhas-arbitragens",
    });

    // Log that we sent the notification
    await supabaseAdmin.from("push_sent_log").insert({
      arbitrage_id: game.id,
      user_id: game.user_id,
    });

    sentCount++;
  }

  // Cleanup old sent logs (older than 24h)
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60000);
  await supabaseAdmin
    .from("push_sent_log")
    .delete()
    .lt("sent_at", oneDayAgo.toISOString());

  return new Response(
    JSON.stringify({ message: "Check complete", sent: sentCount }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action =
      url.searchParams.get("action") ||
      (req.method === "POST"
        ? (await req.clone().json().catch(() => ({}))).action
        : null);

    // Public endpoint - no auth needed
    if (action === "get-vapid-key") {
      return await handleGetVapidKey();
    }

    // Cron endpoint - no user auth, validated by presence of service role
    if (action === "check-and-send") {
      return await handleCheckAndSend();
    }

    // User endpoints - require auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    if (action === "subscribe") {
      return await handleSubscribe(req, supabaseUser);
    }

    if (action === "unsubscribe") {
      return await handleUnsubscribe(req, supabaseUser);
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: corsHeaders,
    });
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
