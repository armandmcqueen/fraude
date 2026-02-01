import { Conversation, Message } from '@/types';

/**
 * Convert a conversation to markdown format
 */
export function conversationToMarkdown(
  conversation: Conversation,
  getPersonaName?: (id: string) => string
): string {
  const lines: string[] = [];

  // Title
  lines.push(`# ${conversation.title}`);
  lines.push('');

  // Metadata
  lines.push(`**Model:** ${conversation.model}`);
  lines.push(`**Created:** ${new Date(conversation.createdAt).toLocaleString()}`);
  lines.push(`**Updated:** ${new Date(conversation.updatedAt).toLocaleString()}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Messages
  for (const message of conversation.messages) {
    const role = message.role === 'user' ? 'User' : getPersonaName?.(message.personaId || '') || 'Assistant';
    const timestamp = new Date(message.createdAt).toLocaleTimeString();

    lines.push(`### ${role} (${timestamp})`);
    lines.push('');
    lines.push(message.content);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Download content as a file
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export conversation as markdown file
 */
export function exportAsMarkdown(
  conversation: Conversation,
  getPersonaName?: (id: string) => string
): void {
  const markdown = conversationToMarkdown(conversation, getPersonaName);
  const filename = `${sanitizeFilename(conversation.title)}.md`;
  downloadFile(markdown, filename, 'text/markdown');
}

/**
 * Export conversation as PDF using browser print
 */
export function exportAsPDF(
  conversation: Conversation,
  getPersonaName?: (id: string) => string
): void {
  const markdown = conversationToMarkdown(conversation, getPersonaName);

  // Create a new window with styled content for printing
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to export as PDF');
    return;
  }

  // Convert markdown to basic HTML
  const html = markdownToSimpleHTML(markdown);

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${conversation.title}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
          max-width: 800px;
          margin: 0 auto;
          padding: 40px 20px;
          line-height: 1.6;
          color: #333;
        }
        h1 {
          border-bottom: 2px solid #333;
          padding-bottom: 10px;
          margin-bottom: 20px;
        }
        h3 {
          color: #555;
          margin-top: 24px;
          margin-bottom: 8px;
          padding-bottom: 4px;
          border-bottom: 1px solid #ddd;
        }
        hr {
          border: none;
          border-top: 1px solid #ddd;
          margin: 20px 0;
        }
        pre {
          background: #f5f5f5;
          padding: 12px;
          border-radius: 4px;
          overflow-x: auto;
          font-size: 14px;
        }
        code {
          background: #f5f5f5;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 14px;
        }
        pre code {
          background: none;
          padding: 0;
        }
        blockquote {
          border-left: 4px solid #ddd;
          margin-left: 0;
          padding-left: 16px;
          color: #666;
        }
        p {
          margin: 12px 0;
        }
        @media print {
          body {
            padding: 20px;
          }
          h3 {
            page-break-after: avoid;
          }
          pre {
            white-space: pre-wrap;
            word-wrap: break-word;
          }
        }
      </style>
    </head>
    <body>
      ${html}
    </body>
    </html>
  `);

  printWindow.document.close();

  // Wait for content to load, then trigger print
  printWindow.onload = () => {
    printWindow.print();
  };
}

/**
 * Convert basic markdown to HTML (simplified)
 */
function markdownToSimpleHTML(markdown: string): string {
  let html = markdown
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr>')
    // Line breaks to paragraphs
    .split('\n\n')
    .map(block => {
      if (block.startsWith('<h') || block.startsWith('<hr') || block.startsWith('<pre')) {
        return block;
      }
      return `<p>${block.replace(/\n/g, '<br>')}</p>`;
    })
    .join('\n');

  return html;
}

/**
 * Sanitize filename
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '_')
    .substring(0, 100);
}
