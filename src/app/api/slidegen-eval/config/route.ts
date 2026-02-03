import { NextRequest, NextResponse } from 'next/server';
import { JsonEvalConfigStorageProvider, JsonEvalConfigHistoryStorageProvider } from '@/lib/storage';
import { stateEventEmitter } from '@/services/slidegen-eval';
import { PromptEnhancerConfig } from '@/types/slidegen-eval';
import { createChangelogEntry, getRequestSource } from '../helpers';

const configStorage = new JsonEvalConfigStorageProvider();
const historyStorage = new JsonEvalConfigHistoryStorageProvider();

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
 * All versions (including current) are stored in history.
 *
 * Request body: { systemPrompt: string, model?: EnhancerModel, imageModel?: ImageGenModel, versionName?: string }
 */
export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { systemPrompt, model, imageModel, versionName } = body;

  if (typeof systemPrompt !== 'string') {
    return NextResponse.json(
      { error: 'systemPrompt is required and must be a string' },
      { status: 400 }
    );
  }

  // Validate model if provided
  const validModels = ['haiku', 'sonnet', 'opus'];
  if (model !== undefined && !validModels.includes(model)) {
    return NextResponse.json(
      { error: `model must be one of: ${validModels.join(', ')}` },
      { status: 400 }
    );
  }

  // Validate imageModel if provided
  const validImageModels = ['gemini-2.5-flash', 'gemini-3-pro'];
  if (imageModel !== undefined && !validImageModels.includes(imageModel)) {
    return NextResponse.json(
      { error: `imageModel must be one of: ${validImageModels.join(', ')}` },
      { status: 400 }
    );
  }

  // Get existing config to determine next version number
  const existingConfig = await configStorage.getConfig();
  const newVersion = (existingConfig?.version || 0) + 1;
  const now = new Date();

  const config: PromptEnhancerConfig = {
    id: existingConfig?.id || 'default',
    systemPrompt,
    model: model || existingConfig?.model || 'sonnet',
    imageModel: imageModel || existingConfig?.imageModel || 'gemini-3-pro',
    version: newVersion,
    versionName: versionName || `v${newVersion}`,
    updatedAt: now,
  };

  // Save to both config (current) and history (all versions)
  await configStorage.saveConfig(config);
  await historyStorage.saveVersion({
    version: config.version,
    versionName: config.versionName,
    systemPrompt: config.systemPrompt,
    model: config.model,
    imageModel: config.imageModel,
    savedAt: now,
  });

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
    `System prompt updated (${config.versionName})`,
    { version: config.version, versionName: config.versionName }
  );

  return NextResponse.json({ config });
}
