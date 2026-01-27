'use client';

import { ConversationConfig, CONFIG_PRESETS } from '@/services/orchestration';
import { PersonaSummary, ResourceSummary, Resource } from '@/types';
import { PersonaSelector } from './PersonaSelector';
import { ResourceManager } from './ResourceManager';

interface ConfigPanelProps {
  config: ConversationConfig;
  onChange: (config: ConversationConfig) => void;
  disabled?: boolean;
  // Persona props
  personas?: PersonaSummary[];
  selectedPersonaIds?: string[];
  onPersonaToggle?: (id: string) => void;
  onPersonaCreate?: (name: string, systemPrompt: string) => Promise<unknown>;
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

export function ConfigPanel({
  config,
  onChange,
  disabled,
  personas,
  selectedPersonaIds,
  onPersonaToggle,
  onPersonaCreate,
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
}: ConfigPanelProps) {
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

  return (
    <div>
      {/* Persona selector */}
      {showPersonaSelector && (
        <PersonaSelector
          personas={personas}
          selectedIds={selectedPersonaIds}
          onToggle={onPersonaToggle}
          onCreate={onPersonaCreate}
          onDelete={onPersonaDelete}
          onMoveUp={onPersonaMoveUp}
          onMoveDown={onPersonaMoveDown}
          disabled={disabled}
          loading={personasLoading}
        />
      )}

      {/* Resource manager */}
      {showResourceManager && (
        <ResourceManager
          resources={resources}
          onFetchResource={onResourceFetch}
          onCreate={onResourceCreate}
          onUpdate={onResourceUpdate}
          onDelete={onResourceDelete}
          disabled={disabled}
          loading={resourcesLoading}
        />
      )}

      {/* Mode selector */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-sm">
        <label className="text-gray-500 dark:text-gray-400 font-medium">Mode:</label>
        <select
          value={currentPresetName}
          onChange={(e) => {
            const preset = CONFIG_PRESETS[e.target.value];
            if (preset) {
              onChange(preset);
            }
          }}
          disabled={disabled}
          className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-gray-900 dark:text-gray-100 disabled:opacity-50 cursor-pointer"
        >
          {Object.keys(CONFIG_PRESETS).map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
