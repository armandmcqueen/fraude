'use client';

import { useEffect, useState } from 'react';
import { useChat } from '@/hooks';
import { ChatSessionInterface } from '@/services';
import { ConversationConfig } from '@/services/orchestration';
import { PersonaSummary, ResourceSummary, Resource, Persona, ViewMode } from '@/types';
import { MessageList } from './MessageList';
import { InputArea } from './InputArea';
import { SettingsModal } from './SettingsModal';
import { LLMInspector } from '@/components/inspector';

interface ChatViewProps {
  session: ChatSessionInterface;
  conversationId: string | null;
  onConversationUpdate?: () => void;
  // Optional config support for multi-persona mode
  config?: ConversationConfig;
  onConfigChange?: (config: ConversationConfig) => void;
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
  // Function to get persona name by ID
  getPersonaName?: (id: string) => string;
  // Resource props
  resources?: ResourceSummary[];
  onResourceFetch?: (id: string) => Promise<Resource | null>;
  onResourceCreate?: (name: string, content: string) => Promise<unknown>;
  onResourceUpdate?: (id: string, name: string, content: string) => Promise<unknown>;
  onResourceDelete?: (id: string) => void;
  resourcesLoading?: boolean;
  // Function to get resource content by name
  getResourceContent?: (name: string) => string | undefined;
  // View mode
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
}

export function ChatView({
  session,
  conversationId,
  onConversationUpdate,
  config,
  onConfigChange,
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
  getPersonaName,
  resources,
  onResourceFetch,
  onResourceCreate,
  onResourceUpdate,
  onResourceDelete,
  resourcesLoading,
  getResourceContent,
  viewMode = 'expanded',
  onViewModeChange,
}: ChatViewProps) {
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const {
    conversation,
    isStreaming,
    error,
    loadConversation,
    createNewConversation,
    setModel,
    sendMessage,
    cancel,
  } = useChat(session, { onConversationUpdate });

  // Load conversation when ID changes
  useEffect(() => {
    if (conversationId) {
      loadConversation(conversationId);
    } else {
      createNewConversation();
    }
  }, [conversationId, loadConversation, createNewConversation]);

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
        <h2 className="font-semibold text-lg truncate">{conversation.title}</h2>
        <div className="flex items-center gap-1">
          {/* View mode toggle */}
          {onViewModeChange && (
            <button
              onClick={() => onViewModeChange(viewMode === 'expanded' ? 'focused' : 'expanded')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'focused'
                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800'
              }`}
              title={viewMode === 'expanded' ? 'Switch to focused view' : 'Switch to expanded view'}
            >
              {viewMode === 'expanded' ? (
                // Focused view icon (tabs/single)
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
              ) : (
                // Expanded view icon (list/all)
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              )}
            </button>
          )}
          {/* Settings button */}
          {config && onConfigChange && (
            <button
              onClick={() => setSettingsOpen(true)}
              className={`p-2 rounded-md transition-colors ${
                settingsOpen
                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800'
              }`}
              title="Settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}
          {/* LLM Inspector button */}
          <button
            onClick={() => setInspectorOpen(!inspectorOpen)}
            className={`p-2 rounded-md transition-colors ${
              inspectorOpen
                ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800'
            }`}
            title="LLM Call Inspector"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-100 dark:bg-red-900 border-b border-red-200 dark:border-red-800 px-4 py-2 text-red-700 dark:text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Messages */}
      <MessageList
        messages={conversation.messages}
        isStreaming={isStreaming}
        getPersonaName={getPersonaName}
        viewMode={viewMode}
        personaOrder={selectedPersonaIds}
      />

      {/* Input */}
      <InputArea
        onSend={sendMessage}
        onCancel={cancel}
        disabled={isStreaming}
        model={conversation.model}
        onModelChange={setModel}
        getResourceContent={getResourceContent}
      />

      {/* LLM Inspector */}
      <LLMInspector
        isOpen={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
        conversationId={conversation.id}
      />

      {/* Settings Modal */}
      {config && onConfigChange && (
        <SettingsModal
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          config={config}
          onConfigChange={onConfigChange}
          disabled={isStreaming}
          personas={personas}
          selectedPersonaIds={selectedPersonaIds}
          onPersonaToggle={onPersonaToggle}
          onPersonaFetch={onPersonaFetch}
          onPersonaCreate={onPersonaCreate}
          onPersonaUpdate={onPersonaUpdate}
          onPersonaDelete={onPersonaDelete}
          onPersonaMoveUp={onPersonaMoveUp}
          onPersonaMoveDown={onPersonaMoveDown}
          personasLoading={personasLoading}
          resources={resources}
          onResourceFetch={onResourceFetch}
          onResourceCreate={onResourceCreate}
          onResourceUpdate={onResourceUpdate}
          onResourceDelete={onResourceDelete}
          resourcesLoading={resourcesLoading}
        />
      )}
    </div>
  );
}
