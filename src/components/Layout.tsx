import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { LayoutDashboard, TrendingUp, List, Users, LogOut, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const { user, userRole, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isAdmin = userRole?.role === 'admin' || userRole?.role === 'admin_master';
  const isAdminMaster = userRole?.role === 'admin_master';

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, show: true },
    { path: '/arbitragens', label: 'Arbitragens', icon: TrendingUp, show: true },
    { path: '/minhas-arbitragens', label: 'Minhas Arbitragens', icon: List, show: true },
    { path: '/usuarios', label: 'Gerenciar Usuários', icon: Users, show: isAdminMaster },
  ];

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
            <div className="container flex h-16 items-center justify-between">
              <div className="flex items-center gap-4">
                <SidebarTrigger />
                
                <Link to="/dashboard" className="flex items-center gap-2">
                  <TrendingUp className="h-6 w-6 text-success" />
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

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2">
                    <User className="h-4 w-4" />
                    <span className="hidden md:inline">{user?.email}</span>
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
          </header>

          <main className="flex-1 container py-6">{children}</main>
          
          <footer className="border-t border-border py-6">
            <div className="container text-center text-sm text-muted-foreground">
              © 2025 Arb From 073. Sistema de Gerenciamento de Arbitragens Esportivas.
            </div>
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
};
