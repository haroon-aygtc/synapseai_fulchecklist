import React from 'react';
import MainLayout from '@/components/layout/MainLayout';
import DashboardOverview from '@/components/dashboard/DashboardOverview';

interface DashboardLayoutProps {
  className?: string;
}

export default function DashboardLayout({ className }: DashboardLayoutProps) {
  return (
    <div className={`min-h-screen bg-background ${className || ''}`}>
      <MainLayout>
        <DashboardOverview />
      </MainLayout>
    </div>
  );
}