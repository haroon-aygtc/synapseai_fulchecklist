'use client';

import { AuthProvider } from '@/lib/auth/auth-context';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import MainLayout from '@/components/layout/MainLayout';
import DashboardOverview from '@/components/dashboard/DashboardOverview';

export default function HomePage() {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <MainLayout>
          <DashboardOverview />
        </MainLayout>
      </ProtectedRoute>
    </AuthProvider>
  );
}