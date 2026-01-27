'use client';

import { useState, useEffect } from 'react';
import { ResourceSummary, Resource } from '@/types';

interface ResourceManagerProps {
  resources: ResourceSummary[];
  onFetchResource: (id: string) => Promise<Resource | null>;
  onCreate: (name: string, content: string) => Promise<unknown>;
  onUpdate: (id: string, name: string, content: string) => Promise<unknown>;
  onDelete: (id: string) => void;
  disabled?: boolean;
  loading?: boolean;
}

export function ResourceManager({
  resources,
  onFetchResource,
  onCreate,
  onUpdate,
  onDelete,
  disabled,
  loading,
}: ResourceManagerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [newName, setNewName] = useState('');
  const [newContent, setNewContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load resource data when editing
  useEffect(() => {
    if (editingId) {
      onFetchResource(editingId).then((resource) => {
        if (resource) {
          setEditingResource(resource);
          setNewName(resource.name);
          setNewContent(resource.content);
        }
      });
    }
  }, [editingId, onFetchResource]);

  const handleCreate = async () => {
    if (!newName.trim() || !newContent.trim()) return;

    setIsSubmitting(true);
    try {
      await onCreate(newName.trim(), newContent.trim());
      setNewName('');
      setNewContent('');
      setIsCreating(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingId || !newName.trim() || !newContent.trim()) return;

    setIsSubmitting(true);
    try {
      await onUpdate(editingId, newName.trim(), newContent.trim());
      setEditingId(null);
      setEditingResource(null);
      setNewName('');
      setNewContent('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingId(null);
    setEditingResource(null);
    setNewName('');
    setNewContent('');
  };

  const handleEdit = (id: string) => {
    setIsCreating(false);
    setEditingId(id);
  };

  if (loading) {
    return (
      <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
        Loading resources...
      </div>
    );
  }

  return (
    <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
      {/* Header with expand/collapse */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 w-full"
      >
        <svg
          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        Resources ({resources.length})
        <span className="text-xs text-gray-400 dark:text-gray-500 font-normal ml-1">
          Use @name to insert
        </span>
      </button>

      {isExpanded && (
        <div className="mt-2">
          {/* Resource list */}
          {resources.length > 0 && (
            <div className="space-y-1 mb-2">
              {resources.map((resource) => (
                <div
                  key={resource.id}
                  className="flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1"
                >
                  <span className="text-sm text-gray-900 dark:text-gray-100">
                    <span className="text-blue-600 dark:text-blue-400">@</span>
                    {resource.name}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(resource.id)}
                      disabled={disabled}
                      className="text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 disabled:opacity-50"
                      title="Edit resource"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onDelete(resource.id)}
                      disabled={disabled}
                      className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-50"
                      title="Delete resource"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Create/Edit form */}
          {(isCreating || editingId) && (
            <div className="p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded mb-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Resource name (e.g., project-context)"
                disabled={isSubmitting}
                className="w-full mb-2 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50"
              />
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Content to substitute when @name is used"
                disabled={isSubmitting}
                rows={4}
                className="w-full mb-2 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50 resize-none font-mono"
              />
              <div className="flex gap-2">
                <button
                  onClick={editingId ? handleUpdate : handleCreate}
                  disabled={isSubmitting || !newName.trim() || !newContent.trim()}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Saving...' : editingId ? 'Update' : 'Create'}
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

          {/* Add button */}
          {!isCreating && !editingId && (
            <button
              onClick={() => setIsCreating(true)}
              disabled={disabled}
              className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Resource
            </button>
          )}
        </div>
      )}
    </div>
  );
}
