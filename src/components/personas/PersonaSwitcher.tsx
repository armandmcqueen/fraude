'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { PersonaSummary } from '@/types';
import { APIPersonaStorageClient } from '@/services';

const personaClient = new APIPersonaStorageClient();

interface PersonaSwitcherProps {
  currentPersonaId: string;
  currentPersonaName: string;
}

export function PersonaSwitcher({ currentPersonaId, currentPersonaName }: PersonaSwitcherProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [personas, setPersonas] = useState<PersonaSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch personas on mount
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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (id: string) => {
    if (id !== currentPersonaId) {
      router.push(`/personas/${id}`);
    }
    setIsOpen(false);
  };

  const otherPersonas = personas.filter((p) => p.id !== currentPersonaId);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        title="Switch persona"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 overflow-hidden">
          {/* Current persona */}
          <div className="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Current</div>
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {currentPersonaName}
            </div>
          </div>

          {/* Other personas */}
          {loading ? (
            <div className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
              Loading...
            </div>
          ) : otherPersonas.length === 0 ? (
            <div className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center italic">
              No other personas
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {otherPersonas.map((persona) => (
                <button
                  key={persona.id}
                  onClick={() => handleSelect(persona.id)}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <span className="truncate block">{persona.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
