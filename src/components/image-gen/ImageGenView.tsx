'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useImageGeneration } from '@/hooks/useImageGeneration';
import { ImageDisplay } from './ImageDisplay';
import { FilmStrip } from './FilmStrip';
import { PromptInput } from './PromptInput';
import { ModelSelector } from './ModelSelector';
import { PromptEnhancerToggle } from './PromptEnhancerToggle';
import { GeneratedImageWithData } from '@/services';

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="flex-shrink-0 p-1 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
      title={`Copy ${label}`}
    >
      {copied ? (
        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  );
}

function PromptInfoBar({ image }: { image: GeneratedImageWithData }) {
  const [showSlidePrompt, setShowSlidePrompt] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm text-gray-600 dark:text-gray-300">
            <span className="font-medium">Prompt:</span>
            <pre className="mt-1 whitespace-pre-wrap font-sans">{image.prompt}</pre>
          </div>
        </div>
        <CopyButton text={image.prompt} label="prompt" />
        {image.isSlideMode && image.slidePrompt && (
          <button
            onClick={() => setShowSlidePrompt(!showSlidePrompt)}
            className="flex-shrink-0 p-1 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
            title={showSlidePrompt ? 'Hide enhanced prompt' : 'Show enhanced prompt'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {showSlidePrompt ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              )}
            </svg>
          </button>
        )}
      </div>
      {image.isSlideMode && image.slidePrompt && showSlidePrompt && (
        <div className="flex items-start gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="flex-1 min-w-0">
            <div className="text-sm text-blue-600 dark:text-blue-400">
              <span className="font-medium">Enhanced Prompt:</span>
              <pre className="mt-1 whitespace-pre-wrap font-sans">{image.slidePrompt}</pre>
            </div>
          </div>
          <CopyButton text={image.slidePrompt} label="enhanced prompt" />
        </div>
      )}
    </div>
  );
}

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
    isSlideMode,
    isGenerating,
    isLoading,
    error,
    generate,
    selectImage,
    selectModel,
    setSlideMode,
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

  // Are we in "new image" mode (no image selected)?
  const isNewMode = selectedId === null;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Film strip sidebar - always visible */}
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

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg m-4">
            <p className="text-gray-500 dark:text-gray-400">Loading images...</p>
          </div>
        ) : isNewMode ? (
          /* New image mode - show prompt input centered */
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="w-full max-w-2xl">
              <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-6 text-center">
                Generate a new image
              </h2>

              {/* Error message */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              <div className="space-y-4">
                <PromptInput onSubmit={handleGenerate} disabled={isGenerating} isSlideMode={isSlideMode} />

                <div className="flex justify-center gap-4 items-center">
                  <ModelSelector
                    selectedModel={selectedModel}
                    onModelChange={selectModel}
                    disabled={isGenerating}
                  />
                  <PromptEnhancerToggle
                    enabled={isSlideMode}
                    onChange={setSlideMode}
                    disabled={isGenerating}
                  />
                </div>
              </div>

              {isGenerating && (
                <div className="mt-8 flex flex-col items-center">
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
              )}
            </div>
          </div>
        ) : (
          /* View image mode - show image with prompt info below */
          <>
            <div className="flex-1 min-h-0 p-4">
              <ImageDisplay image={selectedImage} isGenerating={false} />
            </div>

            {/* Prompt info bar */}
            <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950">
              {selectedImage && (
                <PromptInfoBar image={selectedImage} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
