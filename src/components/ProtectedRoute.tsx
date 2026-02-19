import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('admin_master' | 'admin' | 'operador')[];
}

export const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { user, userRole, isLoading, isExpired, expiresAt, signOut } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (isExpired) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-2" />
            <CardTitle>Acesso Expirado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-muted-foreground">
              Seu acesso expirou em{' '}
              <span className="font-semibold text-foreground">
                {expiresAt ? format(expiresAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : ''}
              </span>.
            </p>
            <p className="text-sm text-muted-foreground">
              Entre em contato com o administrador para renovar seu acesso.
            </p>
            <Button variant="outline" className="w-full" onClick={() => signOut()}>
              Sair
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (allowedRoles && userRole && !allowedRoles.includes(userRole.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
