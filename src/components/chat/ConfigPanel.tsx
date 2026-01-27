'use client';

import { ConversationConfig, CONFIG_PRESETS } from '@/services/orchestration';

interface ConfigPanelProps {
  config: ConversationConfig;
  onChange: (config: ConversationConfig) => void;
  disabled?: boolean;
}

export function ConfigPanel({ config, onChange, disabled }: ConfigPanelProps) {
  const currentPresetName = Object.entries(CONFIG_PRESETS).find(
    ([, preset]) =>
      preset.executionMode === config.executionMode &&
      preset.contextMode === config.contextMode
  )?.[0] || Object.keys(CONFIG_PRESETS)[0];

  return (
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
  );
}
