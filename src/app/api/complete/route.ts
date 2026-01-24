import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { LLMOptions } from '@/types';
import { config } from '@/lib/config';
import { log } from '@/lib/logger';
import { createCallRecorder } from '@/lib/llm-recorder';

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
  const { conversationId, systemPrompt, userPrompt, options }: CompleteRequest =
    await request.json();

  const recorder = createCallRecorder(
    'complete',
    conversationId,
    options.model,
    systemPrompt,
    [{ role: 'user', content: userPrompt }],
    { maxTokens: options.maxTokens || 1024 }
  );

  try {
    const response = await anthropic.messages.create({
      model: options.model,
      max_tokens: options.maxTokens || 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      recorder.success(content.text);
      return NextResponse.json({ content: content.text });
    }

    recorder.success('');
    return NextResponse.json({ content: '' });
  } catch (error) {
    log.error('Error in complete:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    recorder.failure(errorMessage);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
