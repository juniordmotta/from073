import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    console.log('Iniciando deleção de todos os usuários...');

    // Listar todos os usuários
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('Erro ao listar usuários:', listError);
      throw listError;
    }

    console.log(`Encontrados ${users.length} usuários para deletar`);

    // Deletar cada usuário
    const deletePromises = users.map(user => 
      supabaseAdmin.auth.admin.deleteUser(user.id)
    );

    await Promise.all(deletePromises);

    console.log('Todos os usuários foram deletados com sucesso');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${users.length} usuários deletados com sucesso`,
        count: users.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    console.error('Erro ao deletar usuários:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
