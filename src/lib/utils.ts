// Generate a unique ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Generate a conversation title from the first exchange
export function generateTitle(userMessage: string, assistantMessage: string): string {
  // Try to use the user's first sentence/line
  const userFirstLine = userMessage.split(/[.\n]/)[0].trim();

  if (userFirstLine.length > 0 && userFirstLine.length <= 50) {
    return userFirstLine;
  }

  // If user message is too long, truncate
  if (userFirstLine.length > 50) {
    return userFirstLine.substring(0, 47) + '...';
  }

  // Fallback to assistant's first line
  const assistantFirstLine = assistantMessage.split(/[.\n]/)[0].trim();
  if (assistantFirstLine.length <= 50) {
    return assistantFirstLine || 'New conversation';
  }

  return assistantFirstLine.substring(0, 47) + '...';
}
