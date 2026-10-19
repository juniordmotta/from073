import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2.118.0/cors';
import { latestRates } from '../_shared/currency.ts';
Deno.serve(async req => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST' && req.method !== 'GET') return json({ error: 'Método inválido.' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_ANON_KEY');
  const authorization = req.headers.get('Authorization');
  if (!url || !key || !authorization) return json({ error: 'Sessão necessária.' }, 401);
  const client = createClient(url, key, { global: { headers: { Authorization: authorization } } });
  const { data, error } = await client.auth.getUser(authorization.replace(/^Bearer\s+/i, ''));
  if (error || !data.user) return json({ error: 'Sessão inválida.' }, 401);
  try { return json(await latestRates()); } catch { return json({ error: 'Não foi possível obter a cotação atual.' }, 503); }
});