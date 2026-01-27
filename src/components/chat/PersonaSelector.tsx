'use client';

import { useState, useEffect } from 'react';
import { PersonaSummary, Persona } from '@/types';

interface PersonaSelectorProps {
  personas: PersonaSummary[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onFetchPersona?: (id: string) => Promise<Persona | null>;
  onCreate: (name: string, systemPrompt: string) => Promise<unknown>;
  onUpdate?: (id: string, name: string, systemPrompt: string) => Promise<unknown>;
  onDelete: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  disabled?: boolean;
  loading?: boolean;
  /** When true, removes outer padding/border for embedding in modal */
  embedded?: boolean;
}

export function PersonaSelector({
  personas,
  selectedIds,
  onToggle,
  onFetchPersona,
  onCreate,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  disabled,
  loading,
  embedded,
}: PersonaSelectorProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formPrompt, setFormPrompt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingPersona, setIsLoadingPersona] = useState(false);

  // Load persona data when editing
  useEffect(() => {
    if (editingId && onFetchPersona) {
      setIsLoadingPersona(true);
      onFetchPersona(editingId).then((persona) => {
        if (persona) {
          setFormName(persona.name);
          setFormPrompt(persona.systemPrompt);
        }
        setIsLoadingPersona(false);
      });
    }
  }, [editingId, onFetchPersona]);

  const handleCreate = async () => {
    if (!formName.trim() || !formPrompt.trim()) return;

    setIsSubmitting(true);
    try {
      await onCreate(formName.trim(), formPrompt.trim());
      resetForm();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingId || !formName.trim() || !formPrompt.trim() || !onUpdate) return;

    setIsSubmitting(true);
    try {
      await onUpdate(editingId, formName.trim(), formPrompt.trim());
      resetForm();
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormPrompt('');
    setIsCreating(false);
    setEditingId(null);
  };

  const handleEdit = (id: string) => {
    setIsCreating(false);
    setEditingId(id);
    // Form will be populated by useEffect
  };

  const handleStartCreate = () => {
    setEditingId(null);
    setFormName('');
    setFormPrompt('');
    setIsCreating(true);
  };

  // Default persona IDs that cannot be deleted
  const defaultIds = ['optimist', 'critic'];

  // Check if editing is supported
  const canEdit = onFetchPersona !== undefined && onUpdate !== undefined;

  if (loading) {
    return (
      <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
        Loading personas...
      </div>
    );
  }

  // Get selected personas in order, and unselected personas
  const selectedPersonas = selectedIds
    .map((id) => personas.find((p) => p.id === id))
    .filter((p): p is PersonaSummary => p !== undefined);
  const unselectedPersonas = personas.filter((p) => !selectedIds.includes(p.id));

  const isFormOpen = isCreating || editingId !== null;

  return (
    <div className={embedded ? '' : 'px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900'}>
      {!embedded && (
        <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
          Personas (response order)
        </div>
      )}

      {/* Selected personas in order */}
      <div className="flex flex-wrap gap-2 mb-2">
        {selectedPersonas.map((persona, index) => {
          const isDefault = defaultIds.includes(persona.id);
          const canDelete = !isDefault && personas.length > 1;
          const canDeselect = selectedIds.length > 1;
          const isFirst = index === 0;
          const isLast = index === selectedPersonas.length - 1;

          return (
            <div
              key={persona.id}
              className="flex items-center gap-1 bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-600 rounded px-2 py-1"
            >
              {/* Order number */}
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400 w-4">
                {index + 1}.
              </span>

              {/* Up/Down buttons */}
              <div className="flex flex-col -my-0.5">
                <button
                  onClick={() => onMoveUp(persona.id)}
                  disabled={disabled || isFirst}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move up"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => onMoveDown(persona.id)}
                  disabled={disabled || isLast}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move down"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              <span className="text-sm text-gray-900 dark:text-gray-100">
                {persona.name}
              </span>

              {/* Edit button */}
              {canEdit && (
                <button
                  onClick={() => handleEdit(persona.id)}
                  disabled={disabled}
                  className="text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 disabled:opacity-50"
                  title="Edit persona"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}

              {/* Deselect button */}
              {canDeselect && (
                <button
                  onClick={() => onToggle(persona.id)}
                  disabled={disabled}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50"
                  title="Remove from selection"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}

              {/* Delete button */}
              {canDelete && (
                <button
                  onClick={() => onDelete(persona.id)}
                  disabled={disabled}
                  className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-50"
                  title="Delete persona"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Unselected personas */}
      {unselectedPersonas.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {unselectedPersonas.map((persona) => {
            const isDefault = defaultIds.includes(persona.id);
            const canDelete = !isDefault && personas.length > 1;

            return (
              <div
                key={persona.id}
                className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 opacity-60"
              >
                <button
                  onClick={() => onToggle(persona.id)}
                  disabled={disabled}
                  className="text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-50"
                  title="Add to selection"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {persona.name}
                </span>
                {/* Edit button */}
                {canEdit && (
                  <button
                    onClick={() => handleEdit(persona.id)}
                    disabled={disabled}
                    className="text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 disabled:opacity-50"
                    title="Edit persona"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => onDelete(persona.id)}
                    disabled={disabled}
                    className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-50"
                    title="Delete persona"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit form */}
      {isFormOpen && (
        <div className="mt-2 p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded">
          {isLoadingPersona ? (
            <div className="text-sm text-gray-500 dark:text-gray-400 py-2">
              Loading persona...
            </div>
          ) : (
            <>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Persona name"
                disabled={isSubmitting}
                className="w-full mb-2 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50"
              />
              <textarea
                value={formPrompt}
                onChange={(e) => setFormPrompt(e.target.value)}
                placeholder="System prompt (describe the persona's perspective and behavior)"
                disabled={isSubmitting}
                rows={3}
                className="w-full mb-2 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50 resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={editingId ? handleUpdate : handleCreate}
                  disabled={isSubmitting || !formName.trim() || !formPrompt.trim()}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Saving...' : editingId ? 'Update' : 'Create'}
                </button>
                <button
                  onClick={resetForm}
                  disabled={isSubmitting}
                  className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Add button */}
      {!isFormOpen && (
        <button
          onClick={handleStartCreate}
          disabled={disabled}
          className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Persona
        </button>
      )}
    </div>
  );
}
