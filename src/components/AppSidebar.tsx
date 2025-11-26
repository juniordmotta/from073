import { LayoutDashboard, DollarSign, List, Users, TrendingUp } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
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
  const { state } = useSidebar();
  const { userRole } = useAuth();
  
  const isAdmin = userRole?.role === 'admin' || userRole?.role === 'admin_master';
  const isCollapsed = state === 'collapsed';

  const items = [
    { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard, show: true },
    { title: 'Minhas Arbitragens', url: '/minhas-arbitragens', icon: List, show: true },
    { title: 'Relatório Casas', url: '/relatorio-casas', icon: TrendingUp, show: true },
    { title: 'Custos Operacionais', url: '/custos-operacionais', icon: DollarSign, show: true },
    { title: 'Gerenciar Usuários', url: '/usuarios', icon: Users, show: isAdmin },
  ];

  const visibleItems = items.filter(item => item.show);

  return (
    <Sidebar
      className={isCollapsed ? 'w-14' : 'w-60'}
      collapsible="icon"
    >
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      end 
                      className="hover:bg-accent/50" 
                      activeClassName="bg-accent text-accent-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && <span>{item.title}</span>}
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
