'use client';

import MainLayout from '@/components/layout/MainLayout';
import DashboardOverview from '@/components/dashboard/DashboardOverview';

export default function Home() {
  return (
    <MainLayout>
      <DashboardOverview />
    </MainLayout>
  );
}