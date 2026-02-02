import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Modality } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';
import { config, availableImageModels } from '@/lib/config';

const PROMPT_ENHANCER_SYSTEM = `You are an expert at creating prompts for image generation models. Your task is to take raw content (ideas, text, concepts) and transform them into effective prompts for generating slide-style images.

A good slide image prompt should:
1. Be visually clear and impactful
2. Work well as a presentation slide background or illustration
3. Use professional, clean aesthetics
4. Be specific about composition, colors, and style

Guidelines:
- Transform abstract concepts into concrete visual metaphors
- Suggest appropriate styles (e.g., "flat illustration", "minimalist", "professional infographic style")
- Include composition guidance (e.g., "centered", "left third", "with space for text on right")
- Specify color palette when relevant (e.g., "corporate blue tones", "warm gradient background")
- Keep the prompt concise but descriptive (aim for 2-4 sentences)
- IMPORTANT: When text should appear on the slide, specify the EXACT text in quotes. For example: with the title "AI in Healthcare" in bold white text at the top. Be selective about what text to include - usually just a short title or key phrase.

Output ONLY the image generation prompt, nothing else. No explanations, no preamble.`;

async function runPromptEnhancer(content: string): Promise<string> {
  const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

  const response = await anthropic.messages.create({
    model: config.defaultModel, // Claude Sonnet
    max_tokens: 500,
    system: PROMPT_ENHANCER_SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Transform this content into an image generation prompt for a presentation slide:\n\n${content}`,
      },
    ],
  });

  // Extract text from response
  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  return textBlock.text.trim();
}

// POST /api/image-gen - Generate an image using Gemini
export async function POST(request: NextRequest) {
  const { prompt, model, isSlideMode } = await request.json();

  if (!prompt) {
    return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
  }

  if (!config.geminiApiKey) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY not configured' },
      { status: 500 }
    );
  }

  // Validate model if provided, otherwise use default
  const selectedModel = model || config.defaultImageModel;
  const validModelIds = availableImageModels.map(m => m.id);
  if (!validModelIds.includes(selectedModel)) {
    return NextResponse.json(
      { error: `Invalid model. Available: ${validModelIds.join(', ')}` },
      { status: 400 }
    );
  }

  try {
    // If slide mode, generate the image prompt using Claude first
    let imagePrompt = prompt;
    let slidePrompt: string | undefined;

    if (isSlideMode) {
      if (!config.anthropicApiKey) {
        return NextResponse.json(
          { error: 'ANTHROPIC_API_KEY not configured for slide mode' },
          { status: 500 }
        );
      }

      slidePrompt = await runPromptEnhancer(prompt);
      imagePrompt = slidePrompt;
    }

    const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: imagePrompt,
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
      },
    });

    // Extract image from response
    const parts = response.candidates?.[0]?.content?.parts;
    if (!parts) {
      return NextResponse.json(
        { error: 'No response from model' },
        { status: 500 }
      );
    }

    // Find the image part
    const imagePart = parts.find((part) => part.inlineData?.data);
    if (!imagePart?.inlineData) {
      return NextResponse.json(
        { error: 'No image in response' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      base64Data: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType || 'image/png',
      slidePrompt, // Include the generated slide prompt if in slide mode
    });
  } catch (error) {
    console.error('Image generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Image generation failed' },
      { status: 500 }
    );
  }
}
