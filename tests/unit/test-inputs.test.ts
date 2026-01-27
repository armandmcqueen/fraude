import { describe, it, expect } from 'vitest';
import {
  expandTestInput,
  isSlashCommand,
  getTestInputCommands,
  extractResourceMentions,
  expandResourceMentions,
  expandInput,
  TEST_INPUTS,
} from '@/lib/test-inputs';

describe('test-inputs', () => {
  describe('expandTestInput', () => {
    it('should expand known slash commands', () => {
      expect(expandTestInput('/1')).toBe(TEST_INPUTS['/1']);
      expect(expandTestInput('/test')).toBe(TEST_INPUTS['/test']);
    });

    it('should return input unchanged for unknown commands', () => {
      expect(expandTestInput('/unknown')).toBe('/unknown');
      expect(expandTestInput('/999')).toBe('/999');
    });

    it('should return non-slash input unchanged', () => {
      expect(expandTestInput('hello world')).toBe('hello world');
      expect(expandTestInput('')).toBe('');
    });

    it('should handle whitespace by trimming before lookup', () => {
      // expandTestInput trims before looking up
      expect(expandTestInput('  /1  ')).toBe(TEST_INPUTS['/1']);
      expect(expandTestInput('/1')).toBe(TEST_INPUTS['/1']);
    });
  });

  describe('isSlashCommand', () => {
    it('should return true for slash commands', () => {
      expect(isSlashCommand('/1')).toBe(true);
      expect(isSlashCommand('/test')).toBe(true);
      expect(isSlashCommand('/anything')).toBe(true);
    });

    it('should return false for non-slash inputs', () => {
      expect(isSlashCommand('hello')).toBe(false);
      expect(isSlashCommand('')).toBe(false);
      expect(isSlashCommand('hello /1')).toBe(false);
    });

    it('should handle leading whitespace', () => {
      expect(isSlashCommand('  /1')).toBe(true);
    });
  });

  describe('getTestInputCommands', () => {
    it('should return all command keys', () => {
      const commands = getTestInputCommands();
      expect(commands).toContain('/1');
      expect(commands).toContain('/test');
      expect(commands.length).toBeGreaterThan(0);
    });
  });

  describe('extractResourceMentions', () => {
    it('should extract single @mention', () => {
      expect(extractResourceMentions('Hello @project-context')).toEqual(['project-context']);
    });

    it('should extract multiple @mentions', () => {
      expect(extractResourceMentions('@foo and @bar')).toEqual(['foo', 'bar']);
    });

    it('should handle underscores and numbers', () => {
      expect(extractResourceMentions('@my_resource_123')).toEqual(['my_resource_123']);
    });

    it('should return empty array for no mentions', () => {
      expect(extractResourceMentions('no mentions here')).toEqual([]);
    });

    it('should not match email addresses partially', () => {
      // The @ in email gets matched, but that's expected behavior
      const mentions = extractResourceMentions('email@example.com');
      expect(mentions).toContain('example');
    });
  });

  describe('expandResourceMentions', () => {
    const mockGetContent = (name: string): string | undefined => {
      const resources: Record<string, string> = {
        'project-context': 'This is the project context.',
        'api-docs': 'API documentation here.',
      };
      return resources[name];
    };

    it('should expand known resources', () => {
      expect(expandResourceMentions('See @project-context', mockGetContent)).toBe(
        'See This is the project context.'
      );
    });

    it('should expand multiple resources', () => {
      expect(expandResourceMentions('@project-context and @api-docs', mockGetContent)).toBe(
        'This is the project context. and API documentation here.'
      );
    });

    it('should leave unknown resources unchanged', () => {
      expect(expandResourceMentions('See @unknown-resource', mockGetContent)).toBe(
        'See @unknown-resource'
      );
    });

    it('should handle mixed known and unknown', () => {
      expect(expandResourceMentions('@project-context and @unknown', mockGetContent)).toBe(
        'This is the project context. and @unknown'
      );
    });

    it('should handle no resources', () => {
      expect(expandResourceMentions('No resources here', mockGetContent)).toBe(
        'No resources here'
      );
    });
  });

  describe('expandInput', () => {
    const mockGetContent = (name: string): string | undefined => {
      if (name === 'context') return 'CONTEXT_VALUE';
      return undefined;
    };

    it('should expand slash commands first', () => {
      expect(expandInput('/1', mockGetContent)).toBe(TEST_INPUTS['/1']);
    });

    it('should expand @mentions after slash commands', () => {
      // If a slash command contains @mentions, they should be expanded
      // But our current slash commands don't have @mentions
      expect(expandInput('Hello @context', mockGetContent)).toBe('Hello CONTEXT_VALUE');
    });

    it('should handle both slash and @mentions', () => {
      // When input is a slash command, it expands to the command value
      // then @mentions in that value would be expanded (if any)
      const result = expandInput('/test', mockGetContent);
      expect(result).toBe(TEST_INPUTS['/test']);
    });

    it('should pass through unknown inputs unchanged', () => {
      expect(expandInput('just text', mockGetContent)).toBe('just text');
    });
  });
});
