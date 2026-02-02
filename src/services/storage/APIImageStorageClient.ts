import { GeneratedImage, GeneratedImageSummary } from '@/types';

export interface GeneratedImageWithData extends GeneratedImage {
  data: string; // base64 encoded image data
}

/**
 * Image storage client that uses the Next.js API routes.
 */
export class APIImageStorageClient {
  private baseUrl: string;

  constructor(baseUrl: string = '/api/storage/images') {
    this.baseUrl = baseUrl;
  }

  async listImages(): Promise<GeneratedImageSummary[]> {
    const response = await fetch(this.baseUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch images');
    }

    const data = await response.json();
    return data.map((img: GeneratedImageSummary) => ({
      ...img,
      createdAt: new Date(img.createdAt),
    }));
  }

  async getImage(id: string): Promise<GeneratedImageWithData | null> {
    const response = await fetch(`${this.baseUrl}/${id}`);
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error('Failed to fetch image');
    }

    const data = await response.json();
    return {
      ...data,
      createdAt: new Date(data.createdAt),
    };
  }

  async saveImage(
    id: string,
    prompt: string,
    base64Data: string,
    mimeType: string
  ): Promise<GeneratedImage> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, prompt, base64Data, mimeType }),
    });

    if (!response.ok) {
      throw new Error('Failed to save image');
    }

    const data = await response.json();
    return {
      ...data,
      createdAt: new Date(data.createdAt),
    };
  }

  async deleteImage(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to delete image');
    }
  }
}
