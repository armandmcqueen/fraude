import { NextRequest, NextResponse } from 'next/server';
import { UtilityLLMService } from '@/lib/llm';

const utilityService = new UtilityLLMService();

export async function POST(request: NextRequest) {
  try {
    const { userMessage }: { userMessage: string } = await request.json();

    if (!userMessage) {
      return NextResponse.json(
        { error: 'userMessage is required' },
        { status: 400 }
      );
    }

    const title = await utilityService.generateConversationTitle(userMessage);

    return NextResponse.json({ title });
  } catch (error) {
    console.error('Error generating title:', error);
    return NextResponse.json(
      { error: 'Failed to generate title' },
      { status: 500 }
    );
  }
}
