import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ReqBody {
  month: string; // 'YYYY-MM'
  targetUserId?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Unauthorized" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Validar JWT
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData.user) {
      return json({ error: "Invalid token" }, 401);
    }
    const callerId = userData.user.id;

    // Buscar role do caller
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .maybeSingle();
    const role = roleRow?.role ?? "operador";
    const isAdmin = role === "admin" || role === "admin_master";

    const body = (await req.json()) as ReqBody;
    if (!body?.month || !/^\d{4}-\d{2}$/.test(body.month)) {
      return json({ error: "Invalid month" }, 400);
    }

    // SEGURANÇA: operador sempre forçado ao próprio id, ignora targetUserId
    const effectiveUserId =
      isAdmin && body.targetUserId ? body.targetUserId : callerId;

    const [y, m] = body.month.split("-").map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
    const last = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
    const firstDate = first.toISOString().slice(0, 10);
    const lastDate = last.toISOString().slice(0, 10);

    const [arbsRes, costsRes, partsRes] = await Promise.all([
      admin
        .from("arbitrages")
        .select(
          "id, status, lucro_real, casa_01_nome, casa_02_nome, casa_03_nome, casa_01_valor, casa_02_valor, casa_03_valor, casa_01_parceria_id, casa_02_parceria_id, casa_03_parceria_id, created_at"
        )
        .eq("user_id", effectiveUserId)
        .gte("created_at", first.toISOString())
        .lte("created_at", last.toISOString()),
      admin
        .from("operational_costs")
        .select("valor")
        .eq("user_id", effectiveUserId)
        .gte("data", firstDate)
        .lte("data", lastDate),
      admin
        .from("partnerships")
        .select("id, nome_completo, status, saldo_bancario")
        .eq("user_id", effectiveUserId),
    ]);

    const arbs = arbsRes.data || [];
    const costs = costsRes.data || [];
    const partsMap = new Map(
      (partsRes.data || []).map((p: any) => [p.id, p.nome_completo])
    );

    let lucroBruto = 0;
    let totalInvestido = 0;
    let apostasAbertas = 0;
    let apostasFechadas = 0;
    const dias = new Set<string>();
    const casasMap = new Map<string, number>();
    const parceriasMap = new Map<string, number>();

    for (const a of arbs as any[]) {
      totalInvestido +=
        Number(a.casa_01_valor || 0) +
        Number(a.casa_02_valor || 0) +
        Number(a.casa_03_valor || 0);

      if (a.status === "aguardando") {
        apostasAbertas++;
      } else {
        apostasFechadas++;
        lucroBruto += Number(a.lucro_real || 0);
      }

      dias.add(new Date(a.created_at).toISOString().slice(0, 10));

      [a.casa_01_nome, a.casa_02_nome, a.casa_03_nome].forEach((n: string | null) => {
        if (n) casasMap.set(n, (casasMap.get(n) || 0) + 1);
      });
      [a.casa_01_parceria_id, a.casa_02_parceria_id, a.casa_03_parceria_id].forEach(
        (pid: string | null) => {
          if (pid) parceriasMap.set(pid, (parceriasMap.get(pid) || 0) + 1);
        }
      );
    }

    const despesas = costs.reduce(
      (s: number, c: any) => s + Number(c.valor || 0),
      0
    );
    const lucroLiquido = lucroBruto - despesas;
    const roi = totalInvestido > 0 ? (lucroBruto / totalInvestido) * 100 : 0;
    const diasTrabalhados = dias.size;
    const mediaPorDia = diasTrabalhados > 0 ? lucroBruto / diasTrabalhados : 0;

    const casas = Array.from(casasMap.entries())
      .map(([nome, usos]) => ({ nome, usos }))
      .sort((a, b) => b.usos - a.usos)
      .slice(0, 8);

    const parcerias = Array.from(parceriasMap.entries())
      .map(([id, usos]) => ({
        id,
        nome: partsMap.get(id) || "Parceria",
        usos,
      }))
      .sort((a, b) => b.usos - a.usos);

    return json({
      effectiveUserId,
      enforcedByServer: !isAdmin,
      data: {
        lucroBruto,
        despesas,
        lucroLiquido,
        totalInvestido,
        roi,
        totalApostas: arbs.length,
        apostasAbertas,
        apostasFechadas,
        diasTrabalhados,
        mediaPorDia,
        parcerias,
        casas,
      },
    });
  } catch (e) {
    console.error("monthly-report error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
