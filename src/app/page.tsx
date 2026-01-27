'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Sidebar } from '@/components/sidebar';
import { ChatView } from '@/components/chat';
import { useConversations, usePersonas, useResources } from '@/hooks';
import { ViewMode } from '@/types';
import {
  MultiPersonaChatSession,
  TitleService,
  APILLMClient,
  APIStorageClient,
  sequentialOrchestrator,
  ConversationConfig,
  DEFAULT_CONFIG,
} from '@/services';

export default function Home() {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [config, setConfig] = useState<ConversationConfig>(DEFAULT_CONFIG);
  const [viewMode, setViewMode] = useState<ViewMode>('focused');
  const { conversations, loading, refresh } = useConversations();
  const {
    personas,
    selectedIds,
    selectedPersonas,
    fetchFullPersona,
    toggleSelection,
    createPersona,
    updatePersona,
    deletePersona,
    moveUp,
    moveDown,
    getPersonaName,
    loading: personasLoading,
  } = usePersonas();

  const {
    resources,
    fetchFullResource,
    createResource,
    updateResource,
    deleteResource,
    getResourceByName,
    loadAllResources,
    loading: resourcesLoading,
  } = useResources();

  // Load all resources on mount for substitution
  useEffect(() => {
    loadAllResources();
  }, [loadAllResources]);

  // Get resource content by name (for @mention substitution)
  const getResourceContent = useCallback(
    (name: string): string | undefined => {
      const resource = getResourceByName(name);
      return resource?.content;
    },
    [getResourceByName]
  );

  // Create services once (memoized)
  const session = useMemo(() => {
    const llmClient = new APILLMClient();
    const storageClient = new APIStorageClient();
    const titleService = new TitleService(llmClient);

    return new MultiPersonaChatSession({
      llmClient,
      storageClient,
      titleService,
      personas: [], // Start empty, will be updated via useEffect
      orchestrator: sequentialOrchestrator,
    });
  }, []);

  // Update session personas when selection changes
  useEffect(() => {
    if (selectedPersonas.length > 0) {
      session.setPersonas(selectedPersonas);
    }
  }, [selectedPersonas, session]);

  // Update session config when state changes
  const handleConfigChange = useCallback(
    (newConfig: ConversationConfig) => {
      setConfig(newConfig);
      session.setConfig(newConfig);
    },
    [session]
  );

  const handleNewChat = useCallback(() => {
    setActiveConversationId(null);
    session.createNewConversation();
  }, [session]);

  const handleSelectConversation = useCallback((id: string | null) => {
    setActiveConversationId(id);
  }, []);

  return (
    <div className="flex h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <Sidebar
        conversations={conversations}
        activeId={activeConversationId}
        onSelect={handleSelectConversation}
        onCreate={handleNewChat}
        loading={loading}
      />
      <ChatView
        session={session}
        conversationId={activeConversationId}
        onConversationUpdate={refresh}
        config={config}
        onConfigChange={handleConfigChange}
        personas={personas}
        selectedPersonaIds={selectedIds}
        onPersonaToggle={toggleSelection}
        onPersonaFetch={fetchFullPersona}
        onPersonaCreate={createPersona}
        onPersonaUpdate={updatePersona}
        onPersonaDelete={deletePersona}
        onPersonaMoveUp={moveUp}
        onPersonaMoveDown={moveDown}
        personasLoading={personasLoading}
        getPersonaName={getPersonaName}
        resources={resources}
        onResourceFetch={fetchFullResource}
        onResourceCreate={createResource}
        onResourceUpdate={updateResource}
        onResourceDelete={deleteResource}
        resourcesLoading={resourcesLoading}
        getResourceContent={getResourceContent}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />
    </div>
  );
}
