import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Modality } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';
import { config, availableImageModels } from '@/lib/config';

const PROMPT_ENHANCER_SYSTEM = `You are an expert at creating prompts for image generation models. Your task is to take raw content (ideas, text, concepts) and transform them into effective prompts for generating text-centric presentation slides.

IMPORTANT: The generated image should BE the slide itself - the entire image is the slide. Do NOT describe a picture that contains a slide, or a slide on a screen, or a presentation setup. The image IS the slide content directly.

The slides should be TEXT-CENTRIC. The text on the slide should communicate the core idea - someone should be able to understand the main point just by reading the slide.

A good slide prompt should include:
1. A clear title or headline that captures the main idea (in quotes)
2. Optionally 2-4 bullet points or key phrases that support the main idea (each in quotes)
3. An attractive background (gradient, pattern, or subtle imagery)
4. Clear typography

Guidelines:
- Extract the CORE MESSAGE from the input and express it as text on the slide
- Specify exact text in quotes: "Main Title Here" and supporting text like "• First point" "• Second point"
- Keep text concise - distill ideas into punchy, memorable phrases
- Text does NOT need to be large
- Balance visual interest with readability

TEXT STYLING: If you want specific text styling, you must be explicit about WHICH words get WHAT styling. Use markdown within the quoted text to communicate styling:
- **bold text** for emphasis
- *italic text* for subtle emphasis
- Use descriptions like: the word "Innovation" in bold, "key metrics" in italic
- Or: "**Innovation** drives *everything*" to show exact styling

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
