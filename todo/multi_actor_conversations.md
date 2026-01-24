# Multi-Actor Conversations - Implementation Plan

## Overview
Add support for multiple AI "actors" (personas) responding to user messages in a conversation. V0 implements sequential round-robin orchestration where each enabled actor responds in turn after a user message.

## Use Cases
- **Debate/Discussion**: Multiple perspectives on a topic (Optimist vs Critic)
- **Brainstorming**: Creative + Expert actors generating and refining ideas
- **Learning**: Different teaching styles explaining concepts
- **Decision Support**: Multiple viewpoints analyzing options

## V0 Scope
- Sequential round-robin: User sends message → Actor 1 responds → Actor 2 responds → etc.
- Built-in preset actors: Optimist, Critic, Expert, Creative
- User can enable/disable actors per conversation
- User can define custom actors (name + system prompt)
- Each message displays which actor sent it
- Actors see full conversation history (including other actors' responses)

---

## Type Definitions

### New Types (`src/types/index.ts`)
```typescript
interface Actor {
  id: string;
  name: string;
  systemPrompt: string;
  color: string;  // For UI differentiation
  isBuiltIn: boolean;
}

interface ActorConfig {
  enabledActorIds: string[];  // Order determines response order
  customActors: Actor[];
}
```

### Updated Types
```typescript
// Message - add actorId
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
  actorId?: string;  // undefined for user messages, actor ID for assistant
}

// Conversation - add actor config
interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  model: string;
  createdAt: Date;
  updatedAt: Date;
  actorConfig?: ActorConfig;  // undefined = single-actor mode (backward compatible)
}
```

---

## Built-in Actors

**File**: `src/lib/actors.ts`

```typescript
export const BUILT_IN_ACTORS: Actor[] = [
  {
    id: 'optimist',
    name: 'Optimist',
    systemPrompt: 'You are an optimistic assistant who focuses on possibilities, opportunities, and positive outcomes. You acknowledge challenges but emphasize solutions and silver linings.',
    color: '#10B981',  // green
    isBuiltIn: true,
  },
  {
    id: 'critic',
    name: 'Critic',
    systemPrompt: 'You are a critical thinker who identifies potential problems, risks, and weaknesses. You play devil\'s advocate to help surface issues that might be overlooked. Be constructive, not dismissive.',
    color: '#F59E0B',  // amber
    isBuiltIn: true,
  },
  {
    id: 'expert',
    name: 'Expert',
    systemPrompt: 'You are a knowledgeable expert who provides detailed, accurate, and well-researched information. Focus on facts, best practices, and technical depth.',
    color: '#3B82F6',  // blue
    isBuiltIn: true,
  },
  {
    id: 'creative',
    name: 'Creative',
    systemPrompt: 'You are a creative thinker who generates novel ideas, unconventional approaches, and imaginative solutions. Think outside the box and make unexpected connections.',
    color: '#8B5CF6',  // purple
    isBuiltIn: true,
  },
];
```

---

## New Service: MultiActorSession

**File**: `src/services/MultiActorSession.ts`

Extends or wraps ChatSession to handle multi-actor orchestration:

```typescript
class MultiActorSession {
  constructor(config: {
    llmClient: LLMClient;
    storageClient: StorageClient;
    titleService: TitleService;
  });

  // Core methods
  createNewConversation(actorConfig?: ActorConfig): void;
  loadConversation(id: string): Promise<void>;
  sendMessage(content: string): Promise<void>;  // Orchestrates all actor responses

  // Actor management
  setActorConfig(config: ActorConfig): void;
  getActorConfig(): ActorConfig | undefined;
  getEnabledActors(): Actor[];

  // Events (extends ChatSessionEvents)
  events: EventEmitter<MultiActorSessionEvents>;
}

interface MultiActorSessionEvents extends ChatSessionEvents {
  actorStreamStart: (actorId: string) => void;
  actorStreamEnd: (actorId: string) => void;
}
```

### Orchestration Logic
```typescript
async sendMessage(content: string): Promise<void> {
  // 1. Add user message
  // 2. Emit streamStart
  // 3. For each enabled actor (in order):
  //    a. Emit actorStreamStart(actorId)
  //    b. Build system prompt from actor's prompt
  //    c. Stream response, updating message with actorId
  //    d. Emit actorStreamEnd(actorId)
  // 4. Generate title (if first message)
  // 5. Save conversation
  // 6. Emit streamEnd
}
```

---

## UI Components

### 1. ActorSelector (`src/components/chat/ActorSelector.tsx`)
- Dropdown/panel to enable/disable actors
- Drag-and-drop to reorder response order
- Button to create custom actor (opens modal)
- Shows actor colors for visual distinction

### 2. Updated Message Component
- Display actor name/badge with color for assistant messages
- Subtle visual grouping of actor responses to a single user message

### 3. ActorConfigModal (`src/components/chat/ActorConfigModal.tsx`)
- Form to create/edit custom actors
- Fields: name, system prompt, color picker
- Preview of how messages will appear

### 4. Updated ChatView
- Add ActorSelector to header (alongside inspector toggle)
- Pass MultiActorSession instead of ChatSession when actors enabled

---

## File Changes Summary

### New Files
| File | Description |
|------|-------------|
| `src/lib/actors.ts` | Built-in actor definitions |
| `src/services/MultiActorSession.ts` | Multi-actor orchestration service |
| `src/components/chat/ActorSelector.tsx` | Actor enable/disable UI |
| `src/components/chat/ActorConfigModal.tsx` | Custom actor creation form |

### Modified Files
| File | Changes |
|------|---------|
| `src/types/index.ts` | Add Actor, ActorConfig; update Message/Conversation |
| `src/components/chat/Message.tsx` | Display actor name/color badge |
| `src/components/chat/ChatView.tsx` | Add ActorSelector, use MultiActorSession |
| `src/components/chat/MessageList.tsx` | Visual grouping of actor responses |
| `src/app/page.tsx` | Create MultiActorSession |
| `src/hooks/useChat.ts` | Handle new actor events |

---

## Implementation Order

1. **Types & Constants**
   - Add new types to `src/types/index.ts`
   - Create `src/lib/actors.ts` with built-in actors

2. **MultiActorSession Service**
   - Create service with orchestration logic
   - Handle sequential actor responses
   - Integrate with existing LLM client

3. **Message UI Updates**
   - Update Message component for actor display
   - Add visual distinction (name badge, color)

4. **ActorSelector Component**
   - Enable/disable actors
   - Reorder actors
   - Basic custom actor creation

5. **Integration**
   - Update ChatView to use MultiActorSession
   - Update page.tsx
   - Wire up events

6. **Testing & Polish**
   - Manual testing of flows
   - Fix edge cases
   - Update documentation

---

## Verification

1. **Start dev server**: `npm run dev`

2. **Test single-actor mode** (backward compatibility):
   - Create conversation without actors
   - Verify normal chat works

3. **Test multi-actor mode**:
   - Enable 2+ actors (e.g., Optimist + Critic)
   - Send a message
   - Verify both actors respond in sequence
   - Verify actor names/colors display correctly

4. **Test custom actors**:
   - Create a custom actor
   - Verify it appears in selector
   - Verify it responds with custom prompt

5. **Test persistence**:
   - Reload page
   - Verify actor config and messages preserved

6. **Run existing tests**: `npm run test:live`
   - Verify backward compatibility

---

## Future Enhancements (Not V0)
- Parallel actor responses
- Actor-to-actor direct replies
- Actor temperature/creativity settings
- Actor avatars/icons
- Conversation templates with preset actor configs
