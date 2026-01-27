'use client';

import { useState } from 'react';
import { PersonaSummary } from '@/types';

interface PersonaSelectorProps {
  personas: PersonaSummary[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onCreate: (name: string, systemPrompt: string) => Promise<unknown>;
  onDelete: (id: string) => void;
  disabled?: boolean;
  loading?: boolean;
}

export function PersonaSelector({
  personas,
  selectedIds,
  onToggle,
  onCreate,
  onDelete,
  disabled,
  loading,
}: PersonaSelectorProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim() || !newPrompt.trim()) return;

    setIsSubmitting(true);
    try {
      await onCreate(newName.trim(), newPrompt.trim());
      setNewName('');
      setNewPrompt('');
      setIsCreating(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setNewName('');
    setNewPrompt('');
    setIsCreating(false);
  };

  // Default persona IDs that cannot be deleted
  const defaultIds = ['optimist', 'critic'];

  if (loading) {
    return (
      <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
        Loading personas...
      </div>
    );
  }

  return (
    <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
      <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
        Personas
      </div>

      {/* Persona checkboxes */}
      <div className="flex flex-wrap gap-2 mb-2">
        {personas.map((persona) => {
          const isSelected = selectedIds.includes(persona.id);
          const isDefault = defaultIds.includes(persona.id);
          const canDelete = !isDefault && personas.length > 1;
          const canDeselect = selectedIds.length > 1;

          return (
            <div
              key={persona.id}
              className="flex items-center gap-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1"
            >
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggle(persona.id)}
                  disabled={disabled || (isSelected && !canDeselect)}
                  className="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                />
                <span className="text-sm text-gray-900 dark:text-gray-100">
                  {persona.name}
                </span>
              </label>
              {canDelete && (
                <button
                  onClick={() => onDelete(persona.id)}
                  disabled={disabled}
                  className="ml-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-50"
                  title="Delete persona"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          );
        })}

        {/* Add button */}
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            disabled={disabled}
            className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add
          </button>
        )}
      </div>

      {/* Create form */}
      {isCreating && (
        <div className="mt-2 p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Persona name"
            disabled={isSubmitting}
            className="w-full mb-2 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50"
          />
          <textarea
            value={newPrompt}
            onChange={(e) => setNewPrompt(e.target.value)}
            placeholder="System prompt (describe the persona's perspective and behavior)"
            disabled={isSubmitting}
            rows={3}
            className="w-full mb-2 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={isSubmitting || !newName.trim() || !newPrompt.trim()}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : 'Create'}
            </button>
            <button
              onClick={handleCancel}
              disabled={isSubmitting}
              className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
