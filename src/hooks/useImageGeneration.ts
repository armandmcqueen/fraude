'use client';

import { useState, useEffect, useCallback } from 'react';
import { GeneratedImageSummary } from '@/types';
import { APIImageStorageClient, GeneratedImageWithData } from '@/services';
import { config } from '@/lib/config';

const imageClient = new APIImageStorageClient();

function generateId(): string {
  return `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export interface UseImageGenerationResult {
  images: GeneratedImageSummary[];
  selectedImage: GeneratedImageWithData | null;
  selectedId: string | null;
  selectedModel: string;
  isGenerating: boolean;
  isLoading: boolean;
  error: string | null;
  generate: (prompt: string) => Promise<string | null>;
  selectImage: (id: string | null) => Promise<void>;
  selectModel: (model: string) => void;
  deleteImage: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useImageGeneration(): UseImageGenerationResult {
  const [images, setImages] = useState<GeneratedImageSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<GeneratedImageWithData | null>(null);
  const [selectedModel, setSelectedModel] = useState(config.defaultImageModel);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectModel = useCallback((model: string) => {
    setSelectedModel(model);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const list = await imageClient.listImages();
      setImages(list);
    } catch (err) {
      console.error('Failed to load images:', err);
      setError('Failed to load images');
    }
  }, []);

  // Load images on mount
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      await refresh();
      setIsLoading(false);
    };
    load();
  }, [refresh]);

  const selectImage = useCallback(async (id: string | null) => {
    setSelectedId(id);
    if (!id) {
      setSelectedImage(null);
      return;
    }

    try {
      const image = await imageClient.getImage(id);
      setSelectedImage(image);
    } catch (err) {
      console.error('Failed to load image:', err);
      setError('Failed to load image');
    }
  }, []);

  const generate = useCallback(async (prompt: string): Promise<string | null> => {
    setIsGenerating(true);
    setError(null);

    try {
      // Call the image generation API
      const response = await fetch('/api/image-gen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model: selectedModel }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Image generation failed');
      }

      const { base64Data, mimeType } = await response.json();

      // Save the image to storage
      const id = generateId();
      await imageClient.saveImage(id, prompt, base64Data, mimeType);

      // Refresh the list and select the new image
      await refresh();
      await selectImage(id);

      return id;
    } catch (err) {
      console.error('Image generation error:', err);
      setError(err instanceof Error ? err.message : 'Image generation failed');
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [refresh, selectImage, selectedModel]);

  const deleteImage = useCallback(async (id: string) => {
    try {
      await imageClient.deleteImage(id);

      // If we deleted the selected image, clear selection
      if (id === selectedId) {
        setSelectedId(null);
        setSelectedImage(null);
      }

      await refresh();
    } catch (err) {
      console.error('Failed to delete image:', err);
      setError('Failed to delete image');
    }
  }, [selectedId, refresh]);

  return {
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
    refresh,
  };
}
