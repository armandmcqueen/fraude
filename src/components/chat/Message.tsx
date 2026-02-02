'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Message as MessageType } from '@/types';
import { getPersonaName as getDefaultPersonaName } from '@/lib/personas';
import { Switch } from '@/components/ui/switch';

interface MessageProps {
  message: MessageType;
  isStreaming?: boolean;
  getPersonaName?: (id: string) => string;
  isSummarizing?: boolean;
}

export function Message({ message, isStreaming, getPersonaName, isSummarizing }: MessageProps) {
  const [showFull, setShowFull] = useState(false);
  const isUser = message.role === 'user';
  const resolvePersonaName = getPersonaName || getDefaultPersonaName;

  // Determine if we have a summary to show
  const hasSummary = !isUser && !!message.summary;
  const displayContent = hasSummary && !showFull ? message.summary : message.content;

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
    >
      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
        }`}
      >
        {!isUser && message.personaId && (
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {resolvePersonaName(message.personaId)}
            </span>
            {hasSummary && (
              <div className="flex items-center gap-1.5 ml-2">
                <span className={`text-xs ${!showFull ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-400 dark:text-gray-500'}`}>
                  Summary
                </span>
                <Switch
                  size="sm"
                  checked={showFull}
                  onCheckedChange={setShowFull}
                  aria-label={showFull ? 'Show summary' : 'Show full response'}
                />
                <span className={`text-xs ${showFull ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-400 dark:text-gray-500'}`}>
                  Full
                </span>
              </div>
            )}
          </div>
        )}
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  const isInline = !match;

                  if (isInline) {
                    return (
                      <code
                        className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-sm"
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  }

                  return (
                    <SyntaxHighlighter
                      style={oneDark}
                      language={match[1]}
                      PreTag="div"
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  );
                },
              }}
            >
              {displayContent || (isStreaming ? '...' : '')}
            </ReactMarkdown>
          </div>
        )}
        {isStreaming && !message.content && (
          <span className="inline-block animate-pulse">Thinking...</span>
        )}
        {isSummarizing && (
          <span className="inline-block animate-pulse text-xs text-gray-500 dark:text-gray-400 mt-2">
            Summarizing...
          </span>
        )}
      </div>
    </div>
  );
}
