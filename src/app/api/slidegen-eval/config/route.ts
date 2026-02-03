import { NextRequest, NextResponse } from 'next/server';
import { JsonEvalConfigStorageProvider } from '@/lib/storage';
import { stateEventEmitter } from '@/services/slidegen-eval';
import { PromptEnhancerConfig } from '@/types/slidegen-eval';
import { generateId, createChangelogEntry, getRequestSource } from '../helpers';

const configStorage = new JsonEvalConfigStorageProvider();

/**
 * GET /api/slidegen-eval/config
 * Returns the current config, or null if none exists.
 */
export async function GET() {
  const config = await configStorage.getConfig();
  return NextResponse.json({ config });
}

/**
 * PUT /api/slidegen-eval/config
 * Updates the config (creates if doesn't exist).
 *
 * Request body: { systemPrompt: string }
 */
export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { systemPrompt } = body;

  if (typeof systemPrompt !== 'string') {
    return NextResponse.json(
      { error: 'systemPrompt is required and must be a string' },
      { status: 400 }
    );
  }

  // Get existing config or create new one
  const existingConfig = await configStorage.getConfig();

  const config: PromptEnhancerConfig = {
    id: existingConfig?.id || 'default',
    systemPrompt,
    version: (existingConfig?.version || 0) + 1,
    updatedAt: new Date(),
  };

  await configStorage.saveConfig(config);

  // Emit SSE event
  stateEventEmitter.emit({
    type: 'config_updated',
    config,
  });

  // Create changelog entry
  const source = getRequestSource(request);
  await createChangelogEntry(
    source,
    'config_updated',
    `System prompt updated (version ${config.version})`,
    { version: config.version }
  );

  return NextResponse.json({ config });
}
