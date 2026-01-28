import { LayoutDashboard, DollarSign, List, Users, TrendingUp, Handshake, Building2, StickyNote } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

export function AppSidebar() {
  const { state, setOpen, open } = useSidebar();
  const { userRole } = useAuth();
  
  const isAdmin = userRole?.role === 'admin' || userRole?.role === 'admin_master';
  const isCollapsed = state === 'collapsed';

  // Adicionar suporte a swipe no mobile
  useEffect(() => {
    let touchStartX = 0;
    let touchEndX = 0;
    
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.changedTouches[0].screenX;
    };
    
    const handleTouchEnd = (e: TouchEvent) => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
    };
    
    const handleSwipe = () => {
      // Swipe da esquerda para direita (abrir menu)
      if (touchEndX > touchStartX + 50 && touchStartX < 50) {
        setOpen(true);
      }
      // Swipe da direita para esquerda (fechar menu)
      if (touchStartX > touchEndX + 50 && open) {
        setOpen(false);
      }
    };
    
    // Apenas no mobile
    if (window.innerWidth < 768) {
      document.addEventListener('touchstart', handleTouchStart);
      document.addEventListener('touchend', handleTouchEnd);
    }
    
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [setOpen, open]);

  const items = [
    { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard, show: true },
    { title: 'Minhas Arbitragens', url: '/minhas-arbitragens', icon: List, show: true },
    { title: 'Custos Operacionais', url: '/custos-operacionais', icon: DollarSign, show: true },
    { title: 'Parcerias', url: '/parcerias', icon: Handshake, show: true },
    { title: 'Casas de Apostas', url: '/casas-de-apostas', icon: Building2, show: true },
    { title: 'Anotações', url: '/anotacoes', icon: StickyNote, show: true },
    { title: 'Gerenciar Usuários', url: '/usuarios', icon: Users, show: isAdmin },
  ];

  const visibleItems = items.filter(item => item.show);

  return (
    <Sidebar
      className={isCollapsed ? 'w-14' : 'w-60'}
      collapsible="icon"
    >
      <SidebarContent className="bg-black md:bg-primary/0 transition-all duration-300 ease-in-out">
        <SidebarGroup>
          <SidebarGroupLabel className="text-white md:text-foreground">Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      end 
                      className="hover:bg-white/10 md:hover:bg-accent/50 text-white md:text-foreground transition-colors duration-200" 
                      activeClassName="bg-white/20 md:bg-accent text-white md:text-accent-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
