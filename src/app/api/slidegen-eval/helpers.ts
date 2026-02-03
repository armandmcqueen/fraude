import { ChangelogEntry, ChangelogAction } from '@/types/slidegen-eval';
import { JsonEvalChangelogStorageProvider } from '@/lib/storage';
import { stateEventEmitter } from '@/services/slidegen-eval';

const changelogStorage = new JsonEvalChangelogStorageProvider();

/**
 * Generate a unique ID.
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create and persist a changelog entry, then emit it via SSE.
 */
export async function createChangelogEntry(
  source: 'ui' | 'agent',
  action: ChangelogAction,
  summary: string,
  details?: Record<string, unknown>
): Promise<ChangelogEntry> {
  const entry: ChangelogEntry = {
    id: generateId(),
    timestamp: new Date(),
    source,
    action,
    summary,
    details,
  };

  await changelogStorage.appendEntry(entry);

  stateEventEmitter.emit({
    type: 'changelog_entry_added',
    entry,
  });

  return entry;
}

/**
 * Determine the source of the request (UI or agent).
 * Agent requests include an X-Source: agent header.
 */
export function getRequestSource(request: Request): 'ui' | 'agent' {
  const sourceHeader = request.headers.get('X-Source');
  return sourceHeader === 'agent' ? 'agent' : 'ui';
}
