import { NextRequest, NextResponse } from 'next/server';
import { JsonSettingsStorageProvider } from '@/lib/storage';
import { UserSettings } from '@/types';

const storage = new JsonSettingsStorageProvider();

// GET /api/storage/settings - Get user settings
export async function GET() {
  const settings = await storage.getSettings();

  // Return default settings if none exist
  if (!settings) {
    return NextResponse.json({
      selectedPersonaIds: ['optimist', 'critic'],
    });
  }

  return NextResponse.json(settings);
}

// PUT /api/storage/settings - Save user settings
export async function PUT(request: NextRequest) {
  const settings: UserSettings = await request.json();
  await storage.saveSettings(settings);
  return NextResponse.json({ success: true });
}
