'use client';

interface InstructionsEditorProps {
  instructions: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function InstructionsEditor({
  instructions,
  onChange,
  disabled,
}: InstructionsEditorProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Instructions
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Define how this persona should behave and respond
        </p>
      </div>

      {/* Editor */}
      <div className="flex-1 p-4">
        <textarea
          value={instructions}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="Enter system prompt instructions for this persona..."
          className="w-full h-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
        />
      </div>
    </div>
  );
}
