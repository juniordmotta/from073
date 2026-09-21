import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, List, Handshake, Building2, MoreHorizontal, DollarSign, StickyNote, Users, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userRole, signOut } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  const isAdmin = userRole?.role === 'admin' || userRole?.role === 'admin_master';

  const primary = [
    { path: '/dashboard', label: 'Início', icon: LayoutDashboard },
    { path: '/minhas-arbitragens', label: 'Apostas', icon: List },
    { path: '/parcerias', label: 'Parcerias', icon: Handshake },
    { path: '/casas-de-apostas', label: 'Casas', icon: Building2 },
  ];

  const secondary = [
    { path: '/custos-operacionais', label: 'Custos Operacionais', icon: DollarSign, show: true },
    { path: '/anotacoes', label: 'Anotações', icon: StickyNote, show: true },
    { path: '/usuarios', label: 'Gerenciar Usuários', icon: Users, show: isAdmin },
  ].filter((i) => i.show);

  const isMoreActive = secondary.some((i) => i.path === location.pathname);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-mobile-border bg-mobile-surface/90 text-mobile-foreground shadow-2xl backdrop-blur-xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid grid-cols-5">
        {primary.map((item) => {
          const active = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] transition-colors',
                active ? 'text-primary font-semibold' : 'text-mobile-muted'
              )}
            >
              <span className={cn('flex h-7 w-12 items-center justify-center rounded-full transition-colors', active && 'bg-primary/15')}>
                <item.icon className="h-[18px] w-[18px]" />
              </span>
              {item.label}
            </button>
          );
        })}

        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <button
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] transition-colors',
                isMoreActive ? 'text-primary font-semibold' : 'text-mobile-muted'
              )}
            >
              <span className={cn('flex h-7 w-12 items-center justify-center rounded-full transition-colors', isMoreActive && 'bg-primary/15')}>
                <MoreHorizontal className="h-[18px] w-[18px]" />
              </span>
              Mais
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl">
            <SheetHeader className="text-left">
              <SheetTitle>Mais opções</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-1">
              {secondary.map((item) => (
                <Button
                  key={item.path}
                  variant={location.pathname === item.path ? 'secondary' : 'ghost'}
                  className="w-full justify-start gap-3 h-12"
                  onClick={() => {
                    setMoreOpen(false);
                    navigate(item.path);
                  }}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Button>
              ))}
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-12 text-destructive"
                onClick={async () => {
                  setMoreOpen(false);
                  await signOut();
                  navigate('/login');
                }}
              >
                <LogOut className="h-4 w-4" />
                Sair
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
