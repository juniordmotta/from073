import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { supabase } from '@/integrations/supabase/client';
import * as React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarProvider, SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { LayoutDashboard, DollarSign, List, Users, LogOut, User, BarChart3, Handshake } from 'lucide-react';
import { cn, formatUserName } from '@/lib/utils';

interface LayoutProps {
  children: React.ReactNode;
}

// Componente interno para acessar o contexto do Sidebar
const LayoutContent = ({ children }: { children: React.ReactNode }) => {
  const { user, userRole, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [userName, setUserName] = React.useState<string>('');
  const { open, setOpen } = useSidebar();

  const isAdmin = userRole?.role === 'admin' || userRole?.role === 'admin_master';
  const isAdminMaster = userRole?.role === 'admin_master';

  // Buscar nome do usuário do perfil
  React.useEffect(() => {
    const fetchUserName = async () => {
      if (user?.id) {
        const { data } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', user.id)
          .maybeSingle();
        
        if (data?.name) {
          setUserName(formatUserName(data.name));
        } else {
          setUserName(formatUserName(user.email));
        }
      }
    };
    
    fetchUserName();
  }, [user]);

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, show: true },
    { path: '/minhas-arbitragens', label: 'Minhas Arbitragens', icon: List, show: true },
    { path: '/custos-operacionais', label: 'Custos Operacionais', icon: DollarSign, show: true },
    { path: '/parcerias', label: 'Parcerias', icon: Handshake, show: true },
    { path: '/graficos', label: 'Gráficos', icon: BarChart3, show: true },
    { path: '/usuarios', label: 'Gerenciar Usuários', icon: Users, show: isAdminMaster },
  ];

  return (
    <div className="flex min-h-screen w-full">
      {/* Sidebar apenas no mobile */}
      <div className="md:hidden">
        <AppSidebar />
      </div>
      
      {/* Overlay escuro quando sidebar está aberto no mobile */}
      {open && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden animate-fade-in"
          onClick={() => setOpen(false)}
        />
      )}
      
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
          <div className="container flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              {/* SidebarTrigger apenas no mobile */}
              <div className="md:hidden">
                <SidebarTrigger />
              </div>
              
              <Link to="/dashboard" className="flex items-center gap-2">
                <DollarSign className="h-6 w-6 text-success" />
                <span className="text-xl font-bold">Arb From 073</span>
              </Link>
              
              <nav className="hidden md:flex items-center gap-1">
                {navItems.map(
                  (item) =>
                    item.show && (
                      <Button
                        key={item.path}
                        variant="ghost"
                        className={cn(
                          'gap-2 text-foreground hover:bg-accent hover:text-accent-foreground',
                          location.pathname === item.path && 'bg-accent text-accent-foreground'
                        )}
                        onClick={() => navigate(item.path)}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </Button>
                    )
                )}
              </nav>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              
              <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2">
                  <User className="h-4 w-4" />
                  <span className="hidden md:inline">{userName || 'Usuário'}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>
                  Role: {userRole?.role || 'Carregando...'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={async () => {
                  await signOut();
                  navigate('/login');
                }} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="flex-1 container py-6">{children}</main>
        
        <footer className="border-t border-border py-6">
          <div className="container text-center text-sm text-muted-foreground">
            © 2025 Arb From 073. Sistema de Gerenciamento de Arbitragens Esportivas.
          </div>
        </footer>
      </div>
    </div>
  );
};

export const Layout = ({ children }: LayoutProps) => {
  return (
    <SidebarProvider defaultOpen={false}>
      <LayoutContent>{children}</LayoutContent>
    </SidebarProvider>
  );
};
