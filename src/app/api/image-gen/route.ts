import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Modality } from '@google/genai';
import { config, availableImageModels } from '@/lib/config';

// POST /api/image-gen - Generate an image using Gemini
export async function POST(request: NextRequest) {
  const { prompt, model } = await request.json();

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
    const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: prompt,
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
    });
  } catch (error) {
    console.error('Image generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Image generation failed' },
      { status: 500 }
    );
  }
}
