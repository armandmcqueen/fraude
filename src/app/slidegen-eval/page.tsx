'use client';

import { Suspense } from 'react';
import { SlidegenEvalView } from '@/components/slidegen-eval';

function LoadingFallback() {
  return (
    <div className="h-screen flex items-center justify-center bg-white dark:bg-gray-950">
      <p className="text-gray-500 dark:text-gray-400">Loading...</p>
    </div>
  );
}

export default function SlidegenEvalPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <SlidegenEvalView />
    </Suspense>
  );
}
