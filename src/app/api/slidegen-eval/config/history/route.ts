import { NextRequest, NextResponse } from 'next/server';
import { JsonEvalConfigStorageProvider, JsonEvalConfigHistoryStorageProvider } from '@/lib/storage';
import { stateEventEmitter } from '@/services/slidegen-eval';
import { PromptEnhancerConfig } from '@/types/slidegen-eval';
import { createChangelogEntry, getRequestSource } from '../../helpers';

const configStorage = new JsonEvalConfigStorageProvider();
const historyStorage = new JsonEvalConfigHistoryStorageProvider();

/**
 * GET /api/slidegen-eval/config/history
 * Returns all versions (including current).
 */
export async function GET() {
  const versions = await historyStorage.listVersions();
  return NextResponse.json({ versions });
}

/**
 * POST /api/slidegen-eval/config/history
 * Revert to a previous version (creates a new version).
 * All versions (including current) are stored in history.
 *
 * Request body: { version: number }
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { version } = body;

  if (typeof version !== 'number') {
    return NextResponse.json(
      { error: 'version is required and must be a number' },
      { status: 400 }
    );
  }

  // Get the version to revert to (from history, which contains all versions)
  const targetVersion = await historyStorage.getVersion(version);
  if (!targetVersion) {
    return NextResponse.json(
      { error: `Version ${version} not found` },
      { status: 404 }
    );
  }

  // Get existing config to determine next version number
  const existingConfig = await configStorage.getConfig();
  const newVersion = (existingConfig?.version || 0) + 1;

  // Extract the original version name if reverting to a revert
  // e.g., "v8 (revert to v6)" -> "v6", "v6" -> "v6"
  const revertMatch = targetVersion.versionName.match(/\(revert to (.+)\)$/);
  const originalVersionName = revertMatch ? revertMatch[1] : targetVersion.versionName;
  const revertVersionName = `v${newVersion} (revert to ${originalVersionName})`;
  const now = new Date();

  const config: PromptEnhancerConfig = {
    id: existingConfig?.id || 'default',
    systemPrompt: targetVersion.systemPrompt,
    model: targetVersion.model || 'sonnet',
    imageModel: targetVersion.imageModel || 'gemini-3-pro',
    version: newVersion,
    versionName: revertVersionName,
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
    `Reverted to ${targetVersion.versionName} (now ${revertVersionName})`,
    { version: config.version, versionName: config.versionName, revertedFrom: version }
  );

  return NextResponse.json({ config });
}

/**
 * PATCH /api/slidegen-eval/config/history
 * Rename a version in history.
 *
 * Request body: { version: number, name: string }
 */
export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { version, name } = body;

  if (typeof version !== 'number' || typeof name !== 'string') {
    return NextResponse.json(
      { error: 'version (number) and name (string) are required' },
      { status: 400 }
    );
  }

  // Check if version exists in history (all versions are stored there)
  const targetVersion = await historyStorage.getVersion(version);
  if (!targetVersion) {
    return NextResponse.json(
      { error: `Version ${version} not found` },
      { status: 404 }
    );
  }

  // Update in history
  await historyStorage.updateVersionName(version, name);

  // Also update current config if it's the current version
  const currentConfig = await configStorage.getConfig();
  if (currentConfig && currentConfig.version === version) {
    currentConfig.versionName = name;
    await configStorage.saveConfig(currentConfig);

    // Emit SSE event for current config update
    stateEventEmitter.emit({
      type: 'config_updated',
      config: currentConfig,
    });
  }

  return NextResponse.json({ success: true });
}
