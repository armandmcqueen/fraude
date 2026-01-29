'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Persona } from '@/types';
import { APIPersonaStorageClient } from '@/services';
import { generateId } from '@/lib/utils';

const personaClient = new APIPersonaStorageClient();

export default function NewPersonaPage() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const createAndRedirect = async () => {
      if (creating) return;
      setCreating(true);

      try {
        const now = new Date();
        const id = generateId();
        const persona: Persona = {
          id,
          name: 'New Persona',
          systemPrompt: 'You are a helpful assistant.',
          testInputIds: [],
          hidden: true, // Start hidden until saved
          createdAt: now,
          updatedAt: now,
        };

        await personaClient.createPersona(persona);
        router.replace(`/personas/${id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create persona');
        setCreating(false);
      }
    };

    createAndRedirect();
  }, [router, creating]);

  if (error) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 dark:text-red-400 mb-4">{error}</p>
          <button
            onClick={() => router.push('/personas')}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Back to Personas
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-500 dark:text-gray-400">Creating new persona...</p>
      </div>
    </div>
  );
}
