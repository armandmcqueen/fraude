import { Conversation, Message, Persona } from '@/types';

// Re-export Persona from @/types for backwards compatibility
export type { Persona } from '@/types';

// Simple persona type for orchestration (subset of full Persona)
export type OrchestrationPersona = Pick<Persona, 'id' | 'name' | 'systemPrompt'>;

export interface OrchestrationContext {
  personas: OrchestrationPersona[];
  conversation: Conversation;
  userMessage: Message;
}

// The response plan is an ordered list of personas that should respond
export type ResponsePlan = OrchestrationPersona[];

export interface Orchestrator {
  /**
   * Given a user message and context, return which personas should respond and in what order.
   */
  getResponsePlan(context: OrchestrationContext): ResponsePlan;
}
