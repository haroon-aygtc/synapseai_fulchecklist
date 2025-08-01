'use client';

import React, { useState } from 'react';
import { Check, ChevronsUpDown, Building2, Users, Shield } from 'lucide-react';
import { useEnhancedAuth } from '@/lib/auth/enhanced-auth-context';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';

const roleIcons = {
  SUPER_ADMIN: Shield,
  ORG_ADMIN: Shield,
  DEVELOPER: Users,
  VIEWER: Users,
};

const roleColors = {
  SUPER_ADMIN: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  ORG_ADMIN: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  DEVELOPER: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  VIEWER: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

export function OrganizationSwitcher() {
  const { 
    organization, 
    availableOrganizations, 
    switchOrganization, 
    role,
    isLoading 
  } = useEnhancedAuth();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  const handleSwitchOrganization = async (organizationId: string) => {
    if (organizationId === organization?.id) {
      setOpen(false);
      return;
    }

    setSwitching(true);
    try {
      await switchOrganization(organizationId);
      toast({
        title: 'Organization switched',
        description: 'Successfully switched to the selected organization.',
      });
      setOpen(false);
    } catch (error) {
      console.error('Failed to switch organization:', error);
      toast({
        title: 'Error',
        description: 'Failed to switch organization. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSwitching(false);
    }
  };

  if (!organization || availableOrganizations.length <= 1) {
    return (
      <div className="flex items-center space-x-2 px-3 py-2 rounded-md bg-muted">
        <Building2 className="h-4 w-4" />
        <span className="text-sm font-medium">{organization?.name || 'No Organization'}</span>
        {role && (
          <Badge variant="secondary" className={`text-xs ${roleColors[role as keyof typeof roleColors]}`}>
            {role.replace('_', ' ')}
          </Badge>
        )}
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={isLoading || switching}
        >
          <div className="flex items-center space-x-2">
            <Building2 className="h-4 w-4" />
            <span className="truncate">{organization?.name}</span>
            {role && (
              <Badge variant="secondary" className={`text-xs ${roleColors[role as keyof typeof roleColors]}`}>
                {role.replace('_', ' ')}
              </Badge>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder="Search organizations..." />
          <CommandEmpty>No organizations found.</CommandEmpty>
          <CommandGroup>
            {availableOrganizations.map((org) => {
              const RoleIcon = roleIcons[org.role as keyof typeof roleIcons];
              const isSelected = org.id === organization?.id;
              
              return (
                <CommandItem
                  key={org.id}
                  value={org.name}
                  onSelect={() => handleSwitchOrganization(org.id)}
                  className="flex items-center justify-between"
                  disabled={switching}
                >
                  <div className="flex items-center space-x-2">
                    <RoleIcon className="h-4 w-4" />
                    <div className="flex flex-col">
                      <span className="font-medium">{org.name}</span>
                      <span className="text-xs text-muted-foreground">{org.slug}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge 
                      variant="secondary" 
                      className={`text-xs ${roleColors[org.role as keyof typeof roleColors]}`}
                    >
                      {org.role.replace('_', ' ')}
                    </Badge>
                    {isSelected && <Check className="h-4 w-4" />}
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default OrganizationSwitcher;