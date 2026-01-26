import { Conversation, Message } from '@/types';

export interface Persona {
  id: string;
  name: string;
  systemPrompt: string;
}

export interface OrchestrationContext {
  personas: Persona[];
  conversation: Conversation;
  userMessage: Message;
}

// The response plan is an ordered list of personas that should respond
export type ResponsePlan = Persona[];

export interface Orchestrator {
  /**
   * Given a user message and context, return which personas should respond and in what order.
   */
  getResponsePlan(context: OrchestrationContext): ResponsePlan;
}
