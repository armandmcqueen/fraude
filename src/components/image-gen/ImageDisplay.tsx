'use client';

import { GeneratedImageWithData } from '@/services';

interface ImageDisplayProps {
  image: GeneratedImageWithData | null;
  isGenerating: boolean;
}

export function ImageDisplay({ image, isGenerating }: ImageDisplayProps) {
  if (isGenerating) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
        <svg className="w-12 h-12 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <p className="mt-4 text-gray-500 dark:text-gray-400">Generating image...</p>
      </div>
    );
  }

  if (!image) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
        <svg
          className="w-16 h-16 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <p className="mt-4 text-gray-500 dark:text-gray-400">
          Enter a prompt to generate an image
        </p>
      </div>
    );
  }

  const dataUrl = `data:${image.mimeType};base64,${image.data}`;

  return (
    <div className="h-full flex flex-col bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
      <div className="flex-1 flex items-center justify-center p-4 min-h-0 overflow-hidden">
        <img
          src={dataUrl}
          alt={image.prompt}
          className="max-w-full max-h-full object-contain rounded"
        />
      </div>
      <div className="flex-shrink-0 p-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-600 dark:text-gray-300 truncate" title={image.prompt}>
          <span className="font-medium">Prompt:</span> {image.prompt}
        </p>
      </div>
    </div>
  );
}
