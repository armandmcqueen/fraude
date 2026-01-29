'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PersonaSummary } from '@/types';
import { APIPersonaStorageClient } from '@/services';

const personaClient = new APIPersonaStorageClient();

export default function PersonasPage() {
  const [personas, setPersonas] = useState<PersonaSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPersonas = async () => {
      try {
        const data = await personaClient.listPersonas();
        setPersonas(data);
      } catch (err) {
        console.error('Failed to fetch personas:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPersonas();
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Chat
            </Link>
            <div className="h-5 w-px bg-gray-300 dark:bg-gray-600" />
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Persona Studio
            </h1>
          </div>
          <Link
            href="/personas/new"
            className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            New Persona
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-12">
            Loading personas...
          </div>
        ) : personas.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 mb-4">No personas yet.</p>
            <Link
              href="/personas/new"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Create your first persona
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {personas.map((persona) => (
              <Link
                key={persona.id}
                href={`/personas/${persona.id}`}
                className="block p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                      {persona.name}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      ID: {persona.id}
                    </p>
                  </div>
                  <svg
                    className="w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
