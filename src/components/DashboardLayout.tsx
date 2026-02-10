import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/contexts/AdminContext';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  MessageSquare,
  Settings,
  LogOut,
  ChevronUp,
  Shield,
  UserCog,
} from 'lucide-react';
import logo from '@/assets/101kerja-logo.jpg';

function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isAdmin, role, fullName } = useAdmin();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const displayName = fullName || user?.email?.split('@')[0] || 'Admin';
  const userInitials = displayName.slice(0, 2).toUpperCase();

  const mainNavItems = [
    { title: 'Dashboard', url: '/', icon: LayoutDashboard },
    { title: 'Applicants', url: '/applicants', icon: Users },
    { title: 'Jobs', url: '/jobs', icon: Briefcase },
    { title: 'Conversations', url: '/conversations', icon: MessageSquare },
  ];

  // Only show Settings if user is admin
  const systemNavItems = isAdmin
    ? [{ title: 'Settings', url: '/settings', icon: Settings }]
    : [];

  const getRoleBadge = () => {
    if (role === 'admin') {
      return (
        <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 bg-primary">
          <Shield className="h-2.5 w-2.5 mr-0.5" />
          Admin
        </Badge>
      );
    }
    if (role === 'staff') {
      return (
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
          <UserCog className="h-2.5 w-2.5 mr-0.5" />
          Staff
        </Badge>
      );
    }
    return null;
  };

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-2">
          <img src={logo} alt="101Kerja Logo" className="h-8 w-8 rounded-lg object-contain flex-shrink-0" />
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="font-semibold text-sidebar-foreground text-sm">101Kerja</span>
              <span className="text-xs text-sidebar-foreground/60">Admin Portal</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="scrollbar-thin">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60">Main Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {systemNavItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/60">System</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {systemNavItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      tooltip={item.title}
                    >
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <>
                      <div className="flex flex-col flex-1 text-left text-sm leading-tight">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium text-sidebar-foreground">
                            {displayName}
                          </span>
                          {getRoleBadge()}
                        </div>
                        <span className="truncate text-xs text-sidebar-foreground/60">
                          {user?.email}
                        </span>
                      </div>
                      <ChevronUp className="ml-auto h-4 w-4 text-sidebar-foreground/60" />
                    </>
                  )}
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                className="w-56"
                align="end"
                sideOffset={4}
              >
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{displayName}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                  <div className="mt-1">{getRoleBadge()}</div>
                </div>
                <DropdownMenuSeparator />
                {isAdmin && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link to="/settings" className="cursor-pointer">
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-h-screen">
          <header className="h-14 border-b bg-background flex items-center px-4 sticky top-0 z-10">
            <SidebarTrigger className="mr-4" />
          </header>
          <div className="flex-1 p-6 bg-muted/30">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
