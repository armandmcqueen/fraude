'use client';

import { useState } from 'react';
import { ConversationConfig, CONFIG_PRESETS } from '@/services/orchestration';
import { PersonaSummary, ResourceSummary, Resource, Persona } from '@/types';
import { PersonaSelector } from './PersonaSelector';
import { ResourceManager } from './ResourceManager';

type SettingsTab = 'personas' | 'resources' | 'execution';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ConversationConfig;
  onConfigChange: (config: ConversationConfig) => void;
  disabled?: boolean;
  // Persona props
  personas?: PersonaSummary[];
  selectedPersonaIds?: string[];
  onPersonaToggle?: (id: string) => void;
  onPersonaFetch?: (id: string) => Promise<Persona | null>;
  onPersonaCreate?: (name: string, systemPrompt: string) => Promise<unknown>;
  onPersonaUpdate?: (id: string, name: string, systemPrompt: string) => Promise<unknown>;
  onPersonaDelete?: (id: string) => void;
  onPersonaMoveUp?: (id: string) => void;
  onPersonaMoveDown?: (id: string) => void;
  personasLoading?: boolean;
  // Resource props
  resources?: ResourceSummary[];
  onResourceFetch?: (id: string) => Promise<Resource | null>;
  onResourceCreate?: (name: string, content: string) => Promise<unknown>;
  onResourceUpdate?: (id: string, name: string, content: string) => Promise<unknown>;
  onResourceDelete?: (id: string) => void;
  resourcesLoading?: boolean;
}

export function SettingsModal({
  isOpen,
  onClose,
  config,
  onConfigChange,
  disabled,
  personas,
  selectedPersonaIds,
  onPersonaToggle,
  onPersonaFetch,
  onPersonaCreate,
  onPersonaUpdate,
  onPersonaDelete,
  onPersonaMoveUp,
  onPersonaMoveDown,
  personasLoading,
  resources,
  onResourceFetch,
  onResourceCreate,
  onResourceUpdate,
  onResourceDelete,
  resourcesLoading,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('personas');

  if (!isOpen) return null;

  const currentPresetName = Object.entries(CONFIG_PRESETS).find(
    ([, preset]) =>
      preset.executionMode === config.executionMode &&
      preset.contextMode === config.contextMode
  )?.[0] || Object.keys(CONFIG_PRESETS)[0];

  const showPersonaSelector =
    personas !== undefined &&
    selectedPersonaIds !== undefined &&
    onPersonaToggle !== undefined &&
    onPersonaCreate !== undefined &&
    onPersonaDelete !== undefined &&
    onPersonaMoveUp !== undefined &&
    onPersonaMoveDown !== undefined;

  const showResourceManager =
    resources !== undefined &&
    onResourceFetch !== undefined &&
    onResourceCreate !== undefined &&
    onResourceUpdate !== undefined &&
    onResourceDelete !== undefined;

  const tabs: { id: SettingsTab; label: string; show: boolean }[] = [
    { id: 'personas', label: 'Personas', show: showPersonaSelector },
    { id: 'resources', label: 'Resources', show: showResourceManager },
    { id: 'execution', label: 'Execution', show: true },
  ];

  const visibleTabs = tabs.filter((t) => t.show);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Settings
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-6">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Personas Tab */}
          {activeTab === 'personas' && showPersonaSelector && (
            <div className="p-6">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Select and order the personas that will respond to your messages.
                Responses are generated in the order shown.
              </p>
              <PersonaSelector
                personas={personas}
                selectedIds={selectedPersonaIds}
                onToggle={onPersonaToggle}
                onFetchPersona={onPersonaFetch}
                onCreate={onPersonaCreate}
                onUpdate={onPersonaUpdate}
                onDelete={onPersonaDelete}
                onMoveUp={onPersonaMoveUp}
                onMoveDown={onPersonaMoveDown}
                disabled={disabled}
                loading={personasLoading}
                embedded
              />
            </div>
          )}

          {/* Resources Tab */}
          {activeTab === 'resources' && showResourceManager && (
            <div className="p-6">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Create reusable text snippets. Use <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">@name</code> in your messages to insert them.
              </p>
              <ResourceManager
                resources={resources}
                onFetchResource={onResourceFetch}
                onCreate={onResourceCreate}
                onUpdate={onResourceUpdate}
                onDelete={onResourceDelete}
                disabled={disabled}
                loading={resourcesLoading}
                embedded
              />
            </div>
          )}

          {/* Execution Tab */}
          {activeTab === 'execution' && (
            <div className="p-6">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Control how personas generate responses.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Execution Mode
                  </label>
                  <select
                    value={currentPresetName}
                    onChange={(e) => {
                      const preset = CONFIG_PRESETS[e.target.value];
                      if (preset) {
                        onConfigChange(preset);
                      }
                    }}
                    disabled={disabled}
                    className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-gray-100 disabled:opacity-50"
                  >
                    {Object.keys(CONFIG_PRESETS).map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Mode descriptions */}
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2 bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <div>
                    <span className="font-medium">Sequential (shared context):</span> Personas respond one at a time and can see each other&apos;s responses.
                  </div>
                  <div>
                    <span className="font-medium">Sequential (isolated):</span> Personas respond one at a time but only see user messages.
                  </div>
                  <div>
                    <span className="font-medium">Parallel (isolated):</span> All personas respond simultaneously, each only seeing user messages.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
