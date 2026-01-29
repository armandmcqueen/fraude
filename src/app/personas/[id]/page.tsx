'use client';

import { use } from 'react';
import { PersonaEditorView } from '@/components/personas';

interface PersonaEditorPageProps {
  params: Promise<{ id: string }>;
}

export default function PersonaEditorPage({ params }: PersonaEditorPageProps) {
  const { id } = use(params);

  return <PersonaEditorView personaId={id} />;
}
