import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import { 
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { 
  Bot, 
  Workflow, 
  Settings, 
  BarChart3, 
  Database, 
  Zap, 
  Search, 
  Bell, 
  Menu, 
  X,
  ChevronLeft,
  ChevronRight,
  Home,
  Users,
  Shield,
  CreditCard,
  HelpCircle,
  LogOut,
  Moon,
  Sun,
  Command as CommandIcon
} from 'lucide-react';
import { useTheme } from 'next-themes';

interface MainLayoutProps {
  children: React.ReactNode;
  currentPage?: string;
}

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badge?: string;
  subItems?: NavigationItem[];
}

const navigationItems: NavigationItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: Home,
    href: '/dashboard',
  },
  {
    id: 'agents',
    label: 'Agents',
    icon: Bot,
    href: '/agents',
    badge: '12',
    subItems: [
      { id: 'agents-list', label: 'All Agents', icon: Bot, href: '/agents' },
      { id: 'agents-create', label: 'Create Agent', icon: Bot, href: '/agents/create' },
      { id: 'agents-templates', label: 'Templates', icon: Bot, href: '/agents/templates' },
    ]
  },
  {
    id: 'tools',
    label: 'Tools',
    icon: Zap,
    href: '/tools',
    badge: '8',
    subItems: [
      { id: 'tools-list', label: 'All Tools', icon: Zap, href: '/tools' },
      { id: 'tools-create', label: 'Create Tool', icon: Zap, href: '/tools/create' },
      { id: 'tools-marketplace', label: 'Marketplace', icon: Zap, href: '/tools/marketplace' },
    ]
  },
  {
    id: 'workflows',
    label: 'Workflows',
    icon: Workflow,
    href: '/workflows',
    badge: '5',
    subItems: [
      { id: 'workflows-list', label: 'All Workflows', icon: Workflow, href: '/workflows' },
      { id: 'workflows-create', label: 'Create Workflow', icon: Workflow, href: '/workflows/create' },
      { id: 'workflows-templates', label: 'Templates', icon: Workflow, href: '/workflows/templates' },
    ]
  },
  {
    id: 'knowledge',
    label: 'Knowledge Base',
    icon: Database,
    href: '/knowledge',
    subItems: [
      { id: 'knowledge-documents', label: 'Documents', icon: Database, href: '/knowledge/documents' },
      { id: 'knowledge-collections', label: 'Collections', icon: Database, href: '/knowledge/collections' },
      { id: 'knowledge-search', label: 'Search', icon: Database, href: '/knowledge/search' },
    ]
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: BarChart3,
    href: '/analytics',
    subItems: [
      { id: 'analytics-overview', label: 'Overview', icon: BarChart3, href: '/analytics' },
      { id: 'analytics-performance', label: 'Performance', icon: BarChart3, href: '/analytics/performance' },
      { id: 'analytics-costs', label: 'Costs', icon: BarChart3, href: '/analytics/costs' },
    ]
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    href: '/settings',
    subItems: [
      { id: 'settings-general', label: 'General', icon: Settings, href: '/settings' },
      { id: 'settings-providers', label: 'Providers', icon: Settings, href: '/settings/providers' },
      { id: 'settings-team', label: 'Team', icon: Users, href: '/settings/team' },
      { id: 'settings-security', label: 'Security', icon: Shield, href: '/settings/security' },
      { id: 'settings-billing', label: 'Billing', icon: CreditCard, href: '/settings/billing' },
    ]
  },
];

export default function MainLayout({ children, currentPage = 'dashboard' }: MainLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>(['agents', 'tools', 'workflows']);
  const { theme, setTheme } = useTheme();

  // Command palette keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const toggleExpanded = (itemId: string) => {
    setExpandedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const renderNavigationItem = (item: NavigationItem, level = 0) => {
    const isExpanded = expandedItems.includes(item.id);
    const hasSubItems = item.subItems && item.subItems.length > 0;
    const isActive = currentPage === item.id;

    return (
      <div key={item.id} className="space-y-1">
        <Button
          variant={isActive ? "secondary" : "ghost"}
          className={cn(
            "w-full justify-start h-10 px-3",
            level > 0 && "ml-4 w-[calc(100%-1rem)]",
            sidebarCollapsed && level === 0 && "justify-center px-2",
            isActive && "bg-primary/10 text-primary border-r-2 border-primary"
          )}
          onClick={() => {
            if (hasSubItems) {
              toggleExpanded(item.id);
            }
            // Handle navigation here
          }}
        >
          <item.icon className={cn("h-4 w-4", !sidebarCollapsed && "mr-3")} />
          {!sidebarCollapsed && (
            <>
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                  {item.badge}
                </Badge>
              )}
              {hasSubItems && (
                <ChevronRight 
                  className={cn(
                    "h-4 w-4 transition-transform",
                    isExpanded && "rotate-90"
                  )} 
                />
              )}
            </>
          )}
        </Button>
        
        {hasSubItems && isExpanded && !sidebarCollapsed && (
          <div className="space-y-1">
            {item.subItems!.map(subItem => renderNavigationItem(subItem, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Command Palette */}
      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigation">
            {navigationItems.map(item => (
              <CommandItem key={item.id}>
                <item.icon className="mr-2 h-4 w-4" />
                <span>{item.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Quick Actions">
            <CommandItem>
              <Bot className="mr-2 h-4 w-4" />
              <span>Create New Agent</span>
            </CommandItem>
            <CommandItem>
              <Workflow className="mr-2 h-4 w-4" />
              <span>Create New Workflow</span>
            </CommandItem>
            <CommandItem>
              <Zap className="mr-2 h-4 w-4" />
              <span>Create New Tool</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed left-0 top-0 z-50 h-full bg-card border-r border-border transition-all duration-300",
        sidebarCollapsed ? "w-16" : "w-64",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center border-b border-border px-4">
            {!sidebarCollapsed ? (
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <Bot className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  SynapseAI
                </span>
              </div>
            ) : (
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto">
                <Bot className="h-5 w-5 text-white" />
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-2 p-4 overflow-y-auto">
            {navigationItems.map(item => renderNavigationItem(item))}
          </nav>

          {/* Sidebar Toggle */}
          <div className="border-t border-border p-4">
            <Button
              variant="ghost"
              size="sm"
              className={cn("w-full", sidebarCollapsed && "justify-center")}
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Collapse
                </>
              )}
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className={cn(
        "transition-all duration-300",
        sidebarCollapsed ? "lg:ml-16" : "lg:ml-64"
      )}>
        {/* Header */}
        <header className="sticky top-0 z-30 h-16 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
          <div className="flex h-full items-center justify-between px-4">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden"
                onClick={() => setMobileMenuOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search or press Cmd+K"
                  className="w-64 pl-9 pr-4"
                  onClick={() => setCommandOpen(true)}
                  readOnly
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                    <CommandIcon className="h-3 w-3" />K
                  </kbd>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Theme Toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              </Button>

              {/* Notifications */}
              <Button variant="ghost" size="sm" className="relative">
                <Bell className="h-4 w-4" />
                <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs">
                  3
                </Badge>
              </Button>

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src="/avatars/01.png" alt="User" />
                      <AvatarFallback>JD</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1 leading-none">
                      <p className="font-medium">John Doe</p>
                      <p className="w-[200px] truncate text-sm text-muted-foreground">
                        john@example.com
                      </p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Users className="mr-2 h-4 w-4" />
                    <span>Team</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <HelpCircle className="mr-2 h-4 w-4" />
                    <span>Help</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}