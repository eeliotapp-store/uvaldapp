'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDemoStore } from '@/stores/demo-store';

export default function DemoHomePage() {
  const router = useRouter();
  const shift = useDemoStore((s) => s.shift);

  useEffect(() => {
    router.replace(shift ? '/demo/pos' : '/demo/shifts/start');
  }, [shift, router]);

  return (
    <div className="flex items-center justify-center h-96">
      <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
