import { Sidebar } from '@/components/layout/sidebar';
import { BottomNav } from '@/components/layout/bottom-nav';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:pl-64 pb-16 lg:pb-0">
        <div className="p-4 lg:p-6">{children}</div>
      </main>
      <BottomNav />
    </div>
  );
}
