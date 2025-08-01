'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { Button } from '@/components/ui/button';
import { Zap, ArrowLeft } from 'lucide-react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      {/* Left Column - Branding & Info */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/20 flex-col">
        <div className="flex flex-col h-full p-12 justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Zap className="h-6 w-6" />
            </div>
            <span className="text-2xl font-bold">SynapseAI</span>
          </div>

          {/* Main Content */}
          <div className="space-y-6">
            <h1 className="text-4xl font-bold tracking-tight">
              Enterprise AI Orchestration Platform
            </h1>
            <p className="text-xl text-muted-foreground">
              Build, deploy, and manage AI agents with real-time orchestration capabilities across multiple providers, tools, and workflows.
            </p>
            <div className="grid grid-cols-2 gap-4 pt-8">
              <div className="rounded-lg border bg-card p-4">
                <h3 className="font-medium mb-1">Multi-Tenant Design</h3>
                <p className="text-sm text-muted-foreground">Robust authentication, RBAC, and complete data isolation</p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <h3 className="font-medium mb-1">Smart Provider Routing</h3>
                <p className="text-sm text-muted-foreground">Fallback mechanisms across OpenAI, Claude, Gemini, and more</p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <h3 className="font-medium mb-1">Real-time APIX Protocol</h3>
                <p className="text-sm text-muted-foreground">Bi-directional event streaming with auto-reconnection</p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <h3 className="font-medium mb-1">Workflow Orchestration</h3>
                <p className="text-sm text-muted-foreground">Visual designer with drag-and-drop nodes and auto-layout</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} SynapseAI. All rights reserved.
          </div>
        </div>
      </div>

      {/* Right Column - Auth Forms */}
      <div className="w-full lg:w-1/2 flex flex-col">
        <div className="flex items-center justify-between p-6">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <span className="text-sm text-muted-foreground">Back to home</span>
          </div>
          <ThemeSwitcher />
        </div>

        <div className="flex-1 flex items-center justify-center p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-md"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}