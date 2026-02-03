import { promises as fs } from 'fs';
import path from 'path';
import { EvalTestResult, EvalResultStorageProvider } from '@/types/slidegen-eval';
import { config } from '../config';

/**
 * JSON file storage for eval test results.
 * Stores all results in a single file at data/slidegen-eval/test-results.json
 */
export class JsonEvalResultStorageProvider implements EvalResultStorageProvider {
  private dataDir: string;

  constructor(dataDir?: string) {
    this.dataDir = dataDir || config.slidegenEvalDir;
  }

  private getFilePath(): string {
    return path.join(this.dataDir, 'test-results.json');
  }

  private async ensureDataDir(): Promise<void> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch {
      // Directory already exists
    }
  }

  private async readResults(): Promise<EvalTestResult[]> {
    try {
      const filePath = this.getFilePath();
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      return data.map((r: EvalTestResult) => ({
        ...r,
        runStartedAt: new Date(r.runStartedAt),
        runCompletedAt: r.runCompletedAt ? new Date(r.runCompletedAt) : undefined,
      }));
    } catch {
      return [];
    }
  }

  private async writeResults(results: EvalTestResult[]): Promise<void> {
    await this.ensureDataDir();
    const filePath = this.getFilePath();
    await fs.writeFile(filePath, JSON.stringify(results, null, 2), 'utf-8');
  }

  async listResults(): Promise<EvalTestResult[]> {
    return this.readResults();
  }

  async getResult(id: string): Promise<EvalTestResult | null> {
    const results = await this.readResults();
    return results.find((r) => r.id === id) || null;
  }

  async getResultByTestCaseId(testCaseId: string): Promise<EvalTestResult | null> {
    const results = await this.readResults();
    // Return the most recent result for this test case
    const matching = results
      .filter((r) => r.testCaseId === testCaseId)
      .sort((a, b) => b.runStartedAt.getTime() - a.runStartedAt.getTime());

    return matching[0] || null;
  }

  async saveResult(result: EvalTestResult): Promise<void> {
    const results = await this.readResults();
    const existingIndex = results.findIndex((r) => r.id === result.id);

    if (existingIndex >= 0) {
      results[existingIndex] = result;
    } else {
      results.push(result);
    }

    await this.writeResults(results);
  }

  async deleteResultsForTestCase(testCaseId: string): Promise<void> {
    const results = await this.readResults();
    const filtered = results.filter((r) => r.testCaseId !== testCaseId);
    await this.writeResults(filtered);
  }
}
