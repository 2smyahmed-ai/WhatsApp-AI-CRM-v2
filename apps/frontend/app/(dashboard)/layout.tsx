import { ReactNode } from 'react';
import Sidebar from '../../components/layout/Sidebar';
import Header from '../../components/layout/Header';
import NotificationProvider from '../../components/providers/NotificationProvider';
import { RealtimeProvider } from '../../components/providers/RealtimeProvider';
import OnboardingWizard from '../../components/onboarding/OnboardingWizard';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900 dark:bg-[#0B141A] dark:text-white">
      <NotificationProvider />
      <RealtimeProvider>
        <OnboardingWizard />
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header />
          <main className="flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-8 animate-fade-in">
            {children}
          </main>
        </div>
      </RealtimeProvider>
    </div>
  );
}
