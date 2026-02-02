'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { ImageGenView } from '@/components/image-gen/ImageGenView';

function LoadingFallback() {
  return (
    <div className="h-full flex items-center justify-center">
      <p className="text-gray-500 dark:text-gray-400">Loading...</p>
    </div>
  );
}

export default function ImageGenPage() {
  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-950">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back to Chat
          </Link>
          <div className="h-5 w-px bg-gray-300 dark:bg-gray-600" />
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Image Generation
          </h1>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full max-w-6xl mx-auto">
          <Suspense fallback={<LoadingFallback />}>
            <ImageGenView />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
