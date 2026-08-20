import { DemoBanner, DemoSidebar, DemoBottomNav } from '@/components/layout/demo-nav';

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950">
      <DemoSidebar />
      <div className="lg:pl-64">
        <DemoBanner />
        <main className="pb-16 lg:pb-0">
          <div className="p-4 lg:p-6">{children}</div>
        </main>
      </div>
      <DemoBottomNav />
    </div>
  );
}
