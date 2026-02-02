'use client';

import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useImageGeneration } from '@/hooks/useImageGeneration';
import { ImageDisplay } from './ImageDisplay';
import { FilmStrip } from './FilmStrip';
import { PromptInput } from './PromptInput';
import { ModelSelector } from './ModelSelector';

export function ImageGenView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const imageIdFromUrl = searchParams.get('id');

  // Track the last URL we set programmatically to avoid sync loops
  const lastSetUrlId = useRef<string | null>(null);

  const {
    images,
    selectedImage,
    selectedId,
    selectedModel,
    isGenerating,
    isLoading,
    error,
    generate,
    selectImage,
    selectModel,
    deleteImage,
  } = useImageGeneration();

  // Sync state FROM URL only when URL changes externally (browser nav, direct link)
  // Skip if we just set this URL ourselves
  useEffect(() => {
    if (!isLoading && imageIdFromUrl !== lastSetUrlId.current) {
      selectImage(imageIdFromUrl);
      lastSetUrlId.current = imageIdFromUrl;
    }
  }, [imageIdFromUrl, isLoading, selectImage]);

  // Helper to update URL
  const updateUrl = (id: string | null) => {
    lastSetUrlId.current = id;
    if (id) {
      router.push(`/image-gen?id=${id}`, { scroll: false });
    } else {
      router.push('/image-gen', { scroll: false });
    }
  };

  // Handle thumbnail click - update both state and URL
  const handleSelectImage = (id: string | null) => {
    selectImage(id);
    updateUrl(id);
  };

  // Handle generate - the hook will select the new image, then we update URL
  const handleGenerate = async (prompt: string) => {
    const newId = await generate(prompt);
    if (newId) {
      updateUrl(newId);
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Film strip sidebar - fixed width */}
      {images.length > 0 && (
        <div className="flex-shrink-0 w-28 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 overflow-y-auto">
          <div className="p-2">
            <FilmStrip
              images={images}
              selectedId={selectedId}
              onSelect={handleSelectImage}
              onDelete={deleteImage}
            />
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Image display - takes remaining space */}
        <div className="flex-1 min-h-0 p-4">
          {isLoading ? (
            <div className="h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
              <p className="text-gray-500 dark:text-gray-400">Loading images...</p>
            </div>
          ) : (
            <ImageDisplay image={selectedImage} isGenerating={isGenerating} />
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="flex-shrink-0 mx-4 mb-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Prompt input - fixed height */}
        <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950">
          <div className="flex gap-3 items-start">
            <div className="flex-1">
              <PromptInput onSubmit={handleGenerate} disabled={isGenerating} />
            </div>
            <ModelSelector
              selectedModel={selectedModel}
              onModelChange={selectModel}
              disabled={isGenerating}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
