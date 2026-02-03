import { promises as fs } from 'fs';
import path from 'path';
import { EvalTestCase, EvalTestCaseSummary, EvalTestCaseStorageProvider } from '@/types/slidegen-eval';
import { config } from '../config';

const INPUT_TEXT_PREVIEW_LENGTH = 100;

/**
 * JSON file storage for eval test cases.
 * Stores all test cases in a single file at data/slidegen-eval/test-cases.json
 */
export class JsonEvalTestCaseStorageProvider implements EvalTestCaseStorageProvider {
  private dataDir: string;

  constructor(dataDir?: string) {
    this.dataDir = dataDir || config.slidegenEvalDir;
  }

  private getFilePath(): string {
    return path.join(this.dataDir, 'test-cases.json');
  }

  private async ensureDataDir(): Promise<void> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch {
      // Directory already exists
    }
  }

  private async readTestCases(): Promise<EvalTestCase[]> {
    try {
      const filePath = this.getFilePath();
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      return data.map((tc: EvalTestCase) => ({
        ...tc,
        createdAt: new Date(tc.createdAt),
        updatedAt: new Date(tc.updatedAt),
      }));
    } catch {
      return [];
    }
  }

  private async writeTestCases(testCases: EvalTestCase[]): Promise<void> {
    await this.ensureDataDir();
    const filePath = this.getFilePath();
    await fs.writeFile(filePath, JSON.stringify(testCases, null, 2), 'utf-8');
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  async listTestCases(): Promise<EvalTestCaseSummary[]> {
    const testCases = await this.readTestCases();

    return testCases
      .map((tc) => ({
        id: tc.id,
        name: tc.name,
        inputTextPreview: this.truncateText(tc.inputText, INPUT_TEXT_PREVIEW_LENGTH),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getTestCase(id: string): Promise<EvalTestCase | null> {
    const testCases = await this.readTestCases();
    return testCases.find((tc) => tc.id === id) || null;
  }

  async createTestCase(testCase: EvalTestCase): Promise<void> {
    const testCases = await this.readTestCases();
    testCases.push(testCase);
    await this.writeTestCases(testCases);
  }

  async updateTestCase(testCase: EvalTestCase): Promise<void> {
    const testCases = await this.readTestCases();
    const index = testCases.findIndex((tc) => tc.id === testCase.id);

    if (index === -1) {
      throw new Error(`Test case not found: ${testCase.id}`);
    }

    testCases[index] = testCase;
    await this.writeTestCases(testCases);
  }

  async deleteTestCase(id: string): Promise<void> {
    const testCases = await this.readTestCases();
    const filtered = testCases.filter((tc) => tc.id !== id);
    await this.writeTestCases(filtered);
  }
}
