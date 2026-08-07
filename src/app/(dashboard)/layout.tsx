import { Sidebar } from '@/components/layout/sidebar';
import { BottomNav } from '@/components/layout/bottom-nav';
import { SupportButton } from '@/components/support-button';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950">
      <Sidebar />
      <main className="lg:pl-64 pb-16 lg:pb-0">
        <div className="p-4 lg:p-6">{children}</div>
      </main>
      <BottomNav />
      <SupportButton />
    </div>
  );
}
