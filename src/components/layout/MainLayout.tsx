'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { 
  Menu, 
  Search, 
  Bell, 
  Settings, 
  User, 
  ChevronDown,
  Bot,
  Wrench,
  Workflow,
  Database,
  BarChart3,
  Users,
  Palette,
  LogOut,
  Moon,
  Sun,
  Command,
  Plus,
  Home
} from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface MainLayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home, current: false },
  { name: 'Agents', href: '/agents', icon: Bot, current: false },
  { name: 'Tools', href: '/tools', icon: Wrench, current: false },
  { name: 'Workflows', href: '/workflows', icon: Workflow, current: false },
  { name: 'Knowledge', href: '/knowledge', icon: Database, current: false },
  { name: 'Analytics', href: '/analytics', icon: BarChart3, current: false },
  { name: 'Team', href: '/team', icon: Users, current: false },
  { name: 'Settings', href: '/settings', icon: Settings, current: false },
];

export default function MainLayout({ children }: MainLayoutProps) {
  const { user, organization, logout, hasPermission } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Update navigation current state based on pathname
  const updatedNavigation = navigation.map(item => ({
    ...item,
    current: pathname === item.href || pathname.startsWith(item.href + '/'),
  }));

  // Keyboard shortcuts
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen(open => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleQuickAction = (action: string) => {
    setCommandOpen(false);
    switch (action) {
      case 'new-agent':
        router.push('/agents/new');
        break;
      case 'new-tool':
        router.push('/tools/new');
        break;
      case 'new-workflow':
        router.push('/workflows/new');
        break;
      case 'settings':
        router.push('/settings');
        break;
      default:
        break;
    }
  };

  const getInitials = (firstName?: string, lastName?: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 transform bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-r border-slate-200/50 dark:border-slate-700/50 transition-transform duration-300 ease-in-out lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between px-6 border-b border-slate-200/50 dark:border-slate-700/50">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  SynapseAI
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {organization?.name}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <Menu className="w-4 h-4" />
            </Button>
          </div>

          {/* Quick Actions */}
          <div className="p-4 border-b border-slate-200/50 dark:border-slate-700/50">
            <Button
              onClick={() => setCommandOpen(true)}
              variant="outline"
              className="w-full justify-start text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-800/50 border-slate-200/50 dark:border-slate-700/50 hover:bg-slate-100/50 dark:hover:bg-slate-700/50"
            >
              <Search className="w-4 h-4 mr-2" />
              Quick actions...
              <Badge variant="secondary" className="ml-auto text-xs">
                ⌘K
              </Badge>
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            {updatedNavigation.map((item) => (
              <Button
                key={item.name}
                variant={item.current ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start h-10 px-3 font-medium transition-all duration-200",
                  item.current 
                    ? "bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/50 dark:to-purple-950/50 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/50 shadow-sm" 
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100"
                )}
                onClick={() => {
                  router.push(item.href);
                  setSidebarOpen(false);
                }}
              >
                <item.icon className={cn(
                  "w-4 h-4 mr-3",
                  item.current ? "text-blue-600 dark:text-blue-400" : ""
                )} />
                {item.name}
                {item.current && (
                  <div className="ml-auto w-1.5 h-1.5 bg-blue-500 rounded-full" />
                )}
              </Button>
            ))}
          </nav>

          {/* User Profile */}
          <div className="p-4 border-t border-slate-200/50 dark:border-slate-700/50">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-start h-12 px-3 hover:bg-slate-100/50 dark:hover:bg-slate-800/50"
                >
                  <Avatar className="w-8 h-8 mr-3">
                    <AvatarImage src={user?.avatar} />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-sm">
                      {getInitials(user?.firstName, user?.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {user?.email}
                    </p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push('/profile')}>
                  <User className="w-4 h-4 mr-2" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/settings')}>
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                  {theme === 'dark' ? (
                    <Sun className="w-4 h-4 mr-2" />
                  ) : (
                    <Moon className="w-4 h-4 mr-2" />
                  )}
                  Toggle theme
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-red-600 dark:text-red-400">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-72">
        {/* Top bar */}
        <div className="sticky top-0 z-30 flex h-16 items-center justify-between bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>
            
            <div className="hidden sm:flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickAction('new-agent')}
                className="bg-gradient-to-r from-blue-500 to-purple-600 text-white border-0 hover:from-blue-600 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <Plus className="w-4 h-4 mr-1" />
                New Agent
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickAction('new-workflow')}
                className="border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Plus className="w-4 h-4 mr-1" />
                Workflow
              </Button>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCommandOpen(true)}
              className="hidden sm:flex"
            >
              <Command className="w-4 h-4" />
            </Button>
            
            <Button variant="ghost" size="sm" className="relative">
              <Bell className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
            </Button>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>

      {/* Command Palette */}
      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Quick Actions">
            <CommandItem onSelect={() => handleQuickAction('new-agent')}>
              <Bot className="w-4 h-4 mr-2" />
              Create New Agent
            </CommandItem>
            <CommandItem onSelect={() => handleQuickAction('new-tool')}>
              <Wrench className="w-4 h-4 mr-2" />
              Create New Tool
            </CommandItem>
            <CommandItem onSelect={() => handleQuickAction('new-workflow')}>
              <Workflow className="w-4 h-4 mr-2" />
              Create New Workflow
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Navigation">
            {navigation.map((item) => (
              <CommandItem
                key={item.name}
                onSelect={() => {
                  router.push(item.href);
                  setCommandOpen(false);
                }}
              >
                <item.icon className="w-4 h-4 mr-2" />
                {item.name}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}