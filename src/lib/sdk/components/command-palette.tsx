import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useHotkeys } from 'react-hotkeys-hook';
import { 
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Plus, 
  Settings, 
  User, 
  FileText, 
  Zap, 
  Bot, 
  Wrench, 
  GitBranch,
  Play,
  Pause,
  Square,
  Save,
  Download,
  Upload,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  Moon,
  Sun,
  Globe,
  HelpCircle,
  Keyboard,
  History,
  Star,
  Bookmark,
  Filter,
  SortAsc,
  SortDesc,
  RefreshCw,
  Home,
  BarChart3,
  Database,
  Cloud,
  Shield,
  Bell,
  Mail,
  Calendar,
  Clock,
  Users,
  Building,
  CreditCard,
  Package,
  Truck,
  MapPin,
  Phone,
  MessageSquare,
  Video,
  Camera,
  Mic,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  Battery,
  Bluetooth,
  Printer,
  Monitor,
  Smartphone,
  Tablet,
  Laptop,
  Server,
  HardDrive,
  Cpu,
  MemoryStick,
  Router,
  Cable,
  Usb,
  Headphones,
  Speaker,
  Gamepad2,
  Joystick,
  Target,
  Award,
  Trophy,
  Medal,
  Flag,
  Bookmark as BookmarkIcon,
  Heart,
  ThumbsUp,
  ThumbsDown,
  Share,
  Link,
  ExternalLink,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  MoreHorizontal,
  MoreVertical,
  Menu,
  X,
  Check,
  AlertCircle,
  Info,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader,
  Spinner
} from 'lucide-react';

import { CommandPaletteAction } from '@/lib/sdk/types';
import { useSynapseSDK, useKeyboardShortcuts } from '@/lib/sdk/hooks';
import { cn } from '@/lib/utils';

interface CommandPaletteProps {
  actions?: CommandPaletteAction[];
  onActionExecute?: (action: CommandPaletteAction) => void;
  placeholder?: string;
  className?: string;
  theme?: 'light' | 'dark' | 'auto';
  showShortcuts?: boolean;
  enableSearch?: boolean;
  enableRecents?: boolean;
  enableFavorites?: boolean;
  maxRecents?: number;
  categories?: string[];
}

const iconMap: Record<string, React.ComponentType<any>> = {
  // Navigation
  home: Home,
  search: Search,
  menu: Menu,
  settings: Settings,
  user: User,
  
  // Actions
  plus: Plus,
  play: Play,
  pause: Pause,
  square: Square,
  save: Save,
  download: Download,
  upload: Upload,
  copy: Copy,
  trash: Trash2,
  refresh: RefreshCw,
  
  // Visibility
  eye: Eye,
  'eye-off': EyeOff,
  
  // Theme
  moon: Moon,
  sun: Sun,
  
  // Content
  'file-text': FileText,
  database: Database,
  cloud: Cloud,
  package: Package,
  
  // Communication
  mail: Mail,
  phone: Phone,
  'message-square': MessageSquare,
  video: Video,
  
  // Workflow
  zap: Zap,
  bot: Bot,
  wrench: Wrench,
  'git-branch': GitBranch,
  
  // Analytics
  'bar-chart': BarChart3,
  target: Target,
  
  // System
  shield: Shield,
  bell: Bell,
  wifi: Wifi,
  'wifi-off': WifiOff,
  battery: Battery,
  
  // Devices
  monitor: Monitor,
  smartphone: Smartphone,
  tablet: Tablet,
  laptop: Laptop,
  server: Server,
  
  // Media
  camera: Camera,
  mic: Mic,
  'volume-2': Volume2,
  'volume-x': VolumeX,
  headphones: Headphones,
  speaker: Speaker,
  
  // Social
  heart: Heart,
  'thumbs-up': ThumbsUp,
  'thumbs-down': ThumbsDown,
  share: Share,
  link: Link,
  'external-link': ExternalLink,
  
  // Status
  check: Check,
  'alert-circle': AlertCircle,
  info: Info,
  'alert-triangle': AlertTriangle,
  'check-circle': CheckCircle,
  'x-circle': XCircle,
  loader: Loader,
  
  // Arrows
  'arrow-right': ArrowRight,
  'arrow-left': ArrowLeft,
  'arrow-up': ArrowUp,
  'arrow-down': ArrowDown,
  'chevron-right': ChevronRight,
  'chevron-left': ChevronLeft,
  'chevron-up': ChevronUp,
  'chevron-down': ChevronDown,
  
  // More
  'more-horizontal': MoreHorizontal,
  'more-vertical': MoreVertical,
  x: X,
  globe: Globe,
  'help-circle': HelpCircle,
  keyboard: Keyboard,
  history: History,
  star: Star,
  bookmark: BookmarkIcon,
  filter: Filter,
  'sort-asc': SortAsc,
  'sort-desc': SortDesc,
  calendar: Calendar,
  clock: Clock,
  users: Users,
  building: Building,
  'credit-card': CreditCard,
  truck: Truck,
  'map-pin': MapPin,
  bluetooth: Bluetooth,
  printer: Printer,
  'hard-drive': HardDrive,
  cpu: Cpu,
  'memory-stick': MemoryStick,
  router: Router,
  cable: Cable,
  usb: Usb,
  gamepad2: Gamepad2,
  joystick: Joystick,
  award: Award,
  trophy: Trophy,
  medal: Medal,
  flag: Flag
};

const defaultActions: CommandPaletteAction[] = [
  {
    id: 'create-workflow',
    label: 'Create New Workflow',
    description: 'Start building a new workflow',
    icon: 'zap',
    shortcut: ['ctrl', 'n'],
    category: 'Create',
    action: () => console.log('Create workflow')
  },
  {
    id: 'create-agent',
    label: 'Create New Agent',
    description: 'Add a new AI agent',
    icon: 'bot',
    shortcut: ['ctrl', 'shift', 'a'],
    category: 'Create',
    action: () => console.log('Create agent')
  },
  {
    id: 'create-tool',
    label: 'Create New Tool',
    description: 'Add a new tool',
    icon: 'wrench',
    shortcut: ['ctrl', 'shift', 't'],
    category: 'Create',
    action: () => console.log('Create tool')
  },
  {
    id: 'search-workflows',
    label: 'Search Workflows',
    description: 'Find existing workflows',
    icon: 'search',
    shortcut: ['ctrl', 'f'],
    category: 'Search',
    action: () => console.log('Search workflows')
  },
  {
    id: 'toggle-theme',
    label: 'Toggle Theme',
    description: 'Switch between light and dark mode',
    icon: 'moon',
    shortcut: ['ctrl', 'shift', 'l'],
    category: 'Settings',
    action: () => console.log('Toggle theme')
  },
  {
    id: 'open-settings',
    label: 'Open Settings',
    description: 'Configure application settings',
    icon: 'settings',
    shortcut: ['ctrl', ','],
    category: 'Settings',
    action: () => console.log('Open settings')
  },
  {
    id: 'show-help',
    label: 'Show Help',
    description: 'Get help and documentation',
    icon: 'help-circle',
    shortcut: ['?'],
    category: 'Help',
    action: () => console.log('Show help')
  },
  {
    id: 'show-shortcuts',
    label: 'Show Keyboard Shortcuts',
    description: 'View all available shortcuts',
    icon: 'keyboard',
    shortcut: ['ctrl', '/'],
    category: 'Help',
    action: () => console.log('Show shortcuts')
  }
];

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  actions = defaultActions,
  onActionExecute,
  placeholder = 'Type a command or search...',
  className,
  theme = 'auto',
  showShortcuts = true,
  enableSearch = true,
  enableRecents = true,
  enableFavorites = true,
  maxRecents = 10,
  categories
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [recentActions, setRecentActions] = useState<string[]>([]);
  const [favoriteActions, setFavoriteActions] = useState<string[]>([]);
  const { sdk } = useSynapseSDK();

  // Load persisted data
  useEffect(() => {
    if (enableRecents) {
      const stored = localStorage.getItem('command-palette-recents');
      if (stored) {
        setRecentActions(JSON.parse(stored));
      }
    }
    
    if (enableFavorites) {
      const stored = localStorage.getItem('command-palette-favorites');
      if (stored) {
        setFavoriteActions(JSON.parse(stored));
      }
    }
  }, [enableRecents, enableFavorites]);

  // Keyboard shortcuts
  useHotkeys('ctrl+k,cmd+k', (e) => {
    e.preventDefault();
    setOpen(true);
  });

  useHotkeys('escape', () => {
    setOpen(false);
    setSearch('');
  });

  // Register action shortcuts
  const shortcuts = useMemo(() => {
    const shortcutMap: Record<string, () => void> = {};
    
    actions.forEach(action => {
      if (action.shortcut) {
        const key = action.shortcut.join('+');
        shortcutMap[key] = () => executeAction(action);
      }
    });
    
    return shortcutMap;
  }, [actions]);

  useKeyboardShortcuts(shortcuts);

  const executeAction = useCallback(async (action: CommandPaletteAction) => {
    // Check condition
    if (action.condition && !action.condition()) {
      return;
    }

    // Add to recents
    if (enableRecents) {
      const newRecents = [action.id, ...recentActions.filter(id => id !== action.id)].slice(0, maxRecents);
      setRecentActions(newRecents);
      localStorage.setItem('command-palette-recents', JSON.stringify(newRecents));
    }

    // Execute action
    try {
      await action.action();
      
      if (onActionExecute) {
        onActionExecute(action);
      }
      
      // Emit event
      if (sdk) {
        sdk.emit('command-palette:action-executed', {
          actionId: action.id,
          label: action.label,
          category: action.category
        });
      }
    } catch (error) {
      console.error('Failed to execute action:', error);
    }

    setOpen(false);
    setSearch('');
  }, [recentActions, enableRecents, maxRecents, onActionExecute, sdk]);

  const toggleFavorite = useCallback((actionId: string) => {
    const newFavorites = favoriteActions.includes(actionId)
      ? favoriteActions.filter(id => id !== actionId)
      : [...favoriteActions, actionId];
    
    setFavoriteActions(newFavorites);
    localStorage.setItem('command-palette-favorites', JSON.stringify(newFavorites));
  }, [favoriteActions]);

  // Filter and group actions
  const filteredActions = useMemo(() => {
    let filtered = actions;

    // Apply search filter
    if (search && enableSearch) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(action =>
        action.label.toLowerCase().includes(searchLower) ||
        action.description?.toLowerCase().includes(searchLower) ||
        action.category.toLowerCase().includes(searchLower)
      );
    }

    // Apply category filter
    if (categories && categories.length > 0) {
      filtered = filtered.filter(action => categories.includes(action.category));
    }

    // Group by category
    const grouped = filtered.reduce((acc, action) => {
      if (!acc[action.category]) {
        acc[action.category] = [];
      }
      acc[action.category].push(action);
      return acc;
    }, {} as Record<string, CommandPaletteAction[]>);

    return grouped;
  }, [actions, search, enableSearch, categories]);

  const recentActionsData = useMemo(() => {
    if (!enableRecents) return [];
    return recentActions
      .map(id => actions.find(action => action.id === id))
      .filter(Boolean) as CommandPaletteAction[];
  }, [recentActions, actions, enableRecents]);

  const favoriteActionsData = useMemo(() => {
    if (!enableFavorites) return [];
    return favoriteActions
      .map(id => actions.find(action => action.id === id))
      .filter(Boolean) as CommandPaletteAction[];
  }, [favoriteActions, actions, enableFavorites]);

  const renderIcon = (iconName?: string) => {
    if (!iconName) return null;
    const IconComponent = iconMap[iconName];
    return IconComponent ? <IconComponent className="w-4 h-4" /> : null;
  };

  const renderShortcut = (shortcut?: string[]) => {
    if (!showShortcuts || !shortcut) return null;
    return (
      <CommandShortcut>
        {shortcut.map((key, index) => (
          <React.Fragment key={key}>
            {index > 0 && '+'}
            <kbd className="px-1 py-0.5 text-xs bg-gray-100 rounded">
              {key === 'ctrl' ? '⌃' : key === 'cmd' ? '⌘' : key === 'shift' ? '⇧' : key === 'alt' ? '⌥' : key}
            </kbd>
          </React.Fragment>
        ))}
      </CommandShortcut>
    );
  };

  return (
    <>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder={placeholder}
          value={search}
          onValueChange={setSearch}
        />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          {/* Recent Actions */}
          {enableRecents && recentActionsData.length > 0 && (
            <>
              <CommandGroup heading="Recent">
                {recentActionsData.map((action) => (
                  <CommandItem
                    key={`recent-${action.id}`}
                    onSelect={() => executeAction(action)}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      {renderIcon(action.icon)}
                      <div>
                        <div className="font-medium">{action.label}</div>
                        {action.description && (
                          <div className="text-sm text-muted-foreground">
                            {action.description}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {enableFavorites && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(action.id);
                          }}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          <Star
                            className={cn(
                              "w-3 h-3",
                              favoriteActions.includes(action.id)
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-gray-400"
                            )}
                          />
                        </button>
                      )}
                      {renderShortcut(action.shortcut)}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {/* Favorite Actions */}
          {enableFavorites && favoriteActionsData.length > 0 && (
            <>
              <CommandGroup heading="Favorites">
                {favoriteActionsData.map((action) => (
                  <CommandItem
                    key={`favorite-${action.id}`}
                    onSelect={() => executeAction(action)}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      {renderIcon(action.icon)}
                      <div>
                        <div className="font-medium">{action.label}</div>
                        {action.description && (
                          <div className="text-sm text-muted-foreground">
                            {action.description}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(action.id);
                        }}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      </button>
                      {renderShortcut(action.shortcut)}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {/* Grouped Actions */}
          {Object.entries(filteredActions).map(([category, categoryActions]) => (
            <CommandGroup key={category} heading={category}>
              {categoryActions.map((action) => (
                <CommandItem
                  key={action.id}
                  onSelect={() => executeAction(action)}
                  className="flex items-center justify-between"
                  disabled={action.condition && !action.condition()}
                >
                  <div className="flex items-center gap-2">
                    {renderIcon(action.icon)}
                    <div>
                      <div className="font-medium">{action.label}</div>
                      {action.description && (
                        <div className="text-sm text-muted-foreground">
                          {action.description}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {enableFavorites && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(action.id);
                        }}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <Star
                          className={cn(
                            "w-3 h-3",
                            favoriteActions.includes(action.id)
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-gray-400"
                          )}
                        />
                      </button>
                    )}
                    {renderShortcut(action.shortcut)}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>

      {/* Floating trigger hint */}
      <AnimatePresence>
        {!open && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-40"
          >
            <Badge
              variant="outline"
              className="bg-white/80 backdrop-blur-sm border-gray-200 text-gray-600 cursor-pointer hover:bg-white/90 transition-colors"
              onClick={() => setOpen(true)}
            >
              <Keyboard className="w-3 h-3 mr-1" />
              Press ⌘K to open command palette
            </Badge>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default CommandPalette;