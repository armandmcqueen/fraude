'use client';

import { availableImageModels } from '@/lib/config';

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (model: string) => void;
  disabled?: boolean;
}

export function ModelSelector({ selectedModel, onModelChange, disabled }: ModelSelectorProps) {
  return (
    <select
      value={selectedModel}
      onChange={(e) => onModelChange(e.target.value)}
      disabled={disabled}
      className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {availableImageModels.map((model) => (
        <option key={model.id} value={model.id}>
          {model.name}
        </option>
      ))}
    </select>
  );
}
