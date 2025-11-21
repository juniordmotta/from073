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

    const { email, password, name, role } = await req.json()

    console.log('Tentando criar usuário:', email);

    // Verificar se já existe um usuário com este email
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers.users.find(u => u.email === email);

    if (existingUser) {
      console.log('Usuário já existe, deletando:', existingUser.id);
      
      // Deletar o usuário existente
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(existingUser.id);
      
      if (deleteError) {
        console.error('Erro ao deletar usuário existente:', deleteError);
        throw deleteError;
      }
      
      console.log('Usuário existente deletado com sucesso');
    }

    // Criar usuário
    console.log('Criando novo usuário...');
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name }
    })

    if (authError) {
      console.error('Erro ao criar usuário:', authError);
      throw authError;
    }

    console.log('Usuário criado com sucesso:', authData.user.id);

    // Aguardar um pouco para garantir que o trigger rodou
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Usar upsert para garantir que a role seja criada/atualizada
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .upsert({ 
        user_id: authData.user.id,
        role 
      }, {
        onConflict: 'user_id'
      })

    if (roleError) {
      console.error('Erro ao criar/atualizar role:', roleError);
      throw roleError;
    }

    console.log('Role criada/atualizada com sucesso');

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    console.error('Erro na edge function create-user:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})