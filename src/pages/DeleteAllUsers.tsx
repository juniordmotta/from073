import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function DeleteAllUsers() {
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const handleDeleteAllUsers = async () => {
    if (!confirm('⚠️ ATENÇÃO! Esta ação irá deletar TODOS os usuários do sistema de autenticação. Tem certeza que deseja continuar?')) {
      return;
    }

    setIsDeleting(true);

    try {
      const { data, error } = await supabase.functions.invoke('delete-all-users');

      if (error) throw error;

      toast({
        title: 'Sucesso!',
        description: `${data.count} usuários foram deletados do sistema de autenticação.`,
      });

      // Fazer logout após deletar todos
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao deletar usuários',
        description: error.message,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Deletar Todos os Usuários</h1>

        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Ação Perigosa</AlertTitle>
          <AlertDescription>
            Esta página permite deletar TODOS os usuários do sistema de autenticação do Supabase.
            Use com extremo cuidado!
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Limpar Sistema de Autenticação</CardTitle>
            <CardDescription>
              Esta ação irá deletar todos os usuários da tabela auth.users do Supabase.
              Isso é útil quando você limpou as tabelas profiles e user_roles mas ainda
              tem usuários no sistema de autenticação.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              size="lg"
              className="w-full gap-2"
              onClick={handleDeleteAllUsers}
              disabled={isDeleting}
            >
              <Trash2 className="h-5 w-5" />
              {isDeleting ? 'Deletando...' : 'Deletar Todos os Usuários do Auth'}
            </Button>
          </CardContent>
        </Card>

        <Alert>
          <AlertDescription>
            <strong>Importante:</strong> Após deletar todos os usuários, você será deslogado automaticamente
            e precisará criar novos usuários através do formulário de cadastro.
          </AlertDescription>
        </Alert>
      </div>
    </Layout>
  );
}
