'use client';

import React from 'react';
import MainLayout from '@/components/layout/MainLayout';
import DashboardOverview from '@/components/dashboard/DashboardOverview';

export default function HomePage() {
  return (
    <MainLayout currentPage="dashboard">
      <DashboardOverview />
    </MainLayout>
  );
}