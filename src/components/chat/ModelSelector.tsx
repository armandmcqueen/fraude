'use client';

import { availableModels } from '@/lib/config';

interface ModelSelectorProps {
  model: string;
  onChange: (model: string) => void;
  disabled?: boolean;
}

export function ModelSelector({ model, onChange, disabled }: ModelSelectorProps) {
  return (
    <select
      value={model}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
    >
      {availableModels.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </select>
  );
}
