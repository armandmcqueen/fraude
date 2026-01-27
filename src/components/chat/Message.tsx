'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Message as MessageType } from '@/types';
import { getPersonaName as getDefaultPersonaName } from '@/lib/personas';

interface MessageProps {
  message: MessageType;
  isStreaming?: boolean;
  getPersonaName?: (id: string) => string;
}

export function Message({ message, isStreaming, getPersonaName }: MessageProps) {
  const isUser = message.role === 'user';
  const resolvePersonaName = getPersonaName || getDefaultPersonaName;

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
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            {resolvePersonaName(message.personaId)}
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
              {message.content || (isStreaming ? '...' : '')}
            </ReactMarkdown>
          </div>
        )}
        {isStreaming && !message.content && (
          <span className="inline-block animate-pulse">Thinking...</span>
        )}
      </div>
    </div>
  );
}
