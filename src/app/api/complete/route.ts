import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { LLMOptions } from '@/types';
import { config } from '@/lib/config';

const anthropic = new Anthropic({
  apiKey: config.anthropicApiKey,
});

interface CompleteRequest {
  conversationId: string;
  systemPrompt: string;
  userPrompt: string;
  options: LLMOptions;
}

export async function POST(request: NextRequest) {
  try {
    const { systemPrompt, userPrompt, options }: CompleteRequest =
      await request.json();

    const response = await anthropic.messages.create({
      model: options.model,
      max_tokens: options.maxTokens || 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      return NextResponse.json({ content: content.text });
    }

    return NextResponse.json({ content: '' });
  } catch (error) {
    console.error('Error in complete:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
