import { promises as fs } from 'fs';
import path from 'path';
import { GeneratedImage, GeneratedImageSummary } from '@/types';
import { config } from '../config';

interface ImageIndex {
  images: GeneratedImage[];
}

export class JsonImageStorageProvider {
  private imagesDir: string;
  private indexFile: string;

  constructor(imagesDir?: string) {
    this.imagesDir = imagesDir || config.imagesDir;
    this.indexFile = path.join(this.imagesDir, 'index.json');
  }

  private async ensureDir(): Promise<void> {
    try {
      await fs.mkdir(this.imagesDir, { recursive: true });
    } catch {
      // Directory already exists
    }
  }

  private async loadIndex(): Promise<ImageIndex> {
    try {
      const content = await fs.readFile(this.indexFile, 'utf-8');
      return JSON.parse(content);
    } catch {
      return { images: [] };
    }
  }

  private async saveIndex(index: ImageIndex): Promise<void> {
    await this.ensureDir();
    await fs.writeFile(this.indexFile, JSON.stringify(index, null, 2), 'utf-8');
  }

  async listImages(): Promise<GeneratedImageSummary[]> {
    const index = await this.loadIndex();
    return index.images
      .map((img) => ({
        id: img.id,
        prompt: img.prompt,
        slidePrompt: img.slidePrompt,
        isSlideMode: img.isSlideMode,
        createdAt: new Date(img.createdAt),
      }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getImage(id: string): Promise<GeneratedImage | null> {
    const index = await this.loadIndex();
    const image = index.images.find((img) => img.id === id);
    if (!image) return null;

    return {
      ...image,
      createdAt: new Date(image.createdAt),
    };
  }

  async getImageData(id: string): Promise<string | null> {
    const image = await this.getImage(id);
    if (!image) return null;

    try {
      const imagePath = path.join(this.imagesDir, image.imagePath);
      const buffer = await fs.readFile(imagePath);
      return buffer.toString('base64');
    } catch {
      return null;
    }
  }

  async saveImage(
    id: string,
    prompt: string,
    base64Data: string,
    mimeType: string,
    options?: { slidePrompt?: string; isSlideMode?: boolean }
  ): Promise<GeneratedImage> {
    await this.ensureDir();

    // Determine file extension from mimeType
    const ext = mimeType.split('/')[1] || 'png';
    const filename = `${id}.${ext}`;
    const imagePath = path.join(this.imagesDir, filename);

    // Write image data
    const buffer = Buffer.from(base64Data, 'base64');
    await fs.writeFile(imagePath, buffer);

    // Create image metadata
    const image: GeneratedImage = {
      id,
      prompt,
      slidePrompt: options?.slidePrompt,
      isSlideMode: options?.isSlideMode,
      imagePath: filename,
      mimeType,
      createdAt: new Date(),
    };

    // Update index
    const index = await this.loadIndex();
    index.images.push(image);
    await this.saveIndex(index);

    return image;
  }

  async deleteImage(id: string): Promise<void> {
    const index = await this.loadIndex();
    const imageIndex = index.images.findIndex((img) => img.id === id);

    if (imageIndex === -1) return;

    const image = index.images[imageIndex];

    // Delete the image file
    try {
      const imagePath = path.join(this.imagesDir, image.imagePath);
      await fs.unlink(imagePath);
    } catch {
      // File may not exist
    }

    // Remove from index
    index.images.splice(imageIndex, 1);
    await this.saveIndex(index);
  }
}
