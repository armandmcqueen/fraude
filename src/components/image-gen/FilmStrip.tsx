'use client';

import { useState, useEffect } from 'react';
import { GeneratedImageSummary } from '@/types';
import { APIImageStorageClient, GeneratedImageWithData } from '@/services';

const imageClient = new APIImageStorageClient();

interface FilmStripProps {
  images: GeneratedImageSummary[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDelete: (id: string) => void;
}

interface ThumbnailProps {
  image: GeneratedImageSummary;
  isSelected: boolean;
  onClick: () => void;
  onDelete: () => void;
}

function Thumbnail({ image, isSelected, onClick, onDelete }: ThumbnailProps) {
  const [imageData, setImageData] = useState<GeneratedImageWithData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await imageClient.getImage(image.id);
        setImageData(data);
      } catch (err) {
        console.error('Failed to load thumbnail:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [image.id]);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  return (
    <div
      className={`relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden cursor-pointer border-2 transition-all group ${
        isSelected
          ? 'border-blue-500 ring-2 ring-blue-500/50'
          : 'border-transparent hover:border-gray-400'
      }`}
      onClick={onClick}
      title={image.prompt}
    >
      {loading ? (
        <div className="w-full h-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
      ) : imageData ? (
        <img
          src={`data:${imageData.mimeType};base64,${imageData.data}`}
          alt={image.prompt}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
          <svg
            className="w-6 h-6 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
      )}
      <button
        onClick={handleDelete}
        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

function NewImageButton({ isSelected, onClick }: { isSelected: boolean; onClick: () => void }) {
  return (
    <div
      className={`relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden cursor-pointer border-2 transition-all flex items-center justify-center bg-gray-100 dark:bg-gray-800 ${
        isSelected
          ? 'border-blue-500 ring-2 ring-blue-500/50'
          : 'border-dashed border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
      }`}
      onClick={onClick}
      title="Generate new image"
    >
      <svg
        className={`w-8 h-8 ${isSelected ? 'text-blue-500' : 'text-gray-400'}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    </div>
  );
}

export function FilmStrip({ images, selectedId, onSelect, onDelete }: FilmStripProps) {
  return (
    <div className="flex flex-col gap-2 overflow-y-auto py-2 px-1">
      <NewImageButton
        isSelected={selectedId === null}
        onClick={() => onSelect(null)}
      />
      {images.map((image) => (
        <Thumbnail
          key={image.id}
          image={image}
          isSelected={image.id === selectedId}
          onClick={() => onSelect(image.id)}
          onDelete={() => onDelete(image.id)}
        />
      ))}
    </div>
  );
}
