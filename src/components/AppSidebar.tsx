import { LayoutDashboard, DollarSign, List, Users, TrendingUp, Handshake } from 'lucide-react';
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
    { title: 'Custos Operacionais', url: '/custos-operacionais', icon: DollarSign, show: true },
    { title: 'Parcerias', url: '/parcerias', icon: Handshake, show: true },
    { title: 'Gerenciar Usuários', url: '/usuarios', icon: Users, show: isAdmin },
  ];

  const visibleItems = items.filter(item => item.show);

  return (
    <Sidebar
      className={isCollapsed ? 'w-14' : 'w-60'}
      collapsible="icon"
    >
      <SidebarContent className="bg-success/90 md:bg-primary/0">
        <SidebarGroup>
          <SidebarGroupLabel className="text-black md:text-foreground">Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      end 
                      className="hover:bg-accent/50 text-black md:text-foreground" 
                      activeClassName="bg-accent text-black md:text-accent-foreground font-medium"
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
