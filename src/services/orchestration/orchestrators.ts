import { Orchestrator } from './types';

/**
 * All personas respond in sequence, in the order they're configured.
 */
export const sequentialOrchestrator: Orchestrator = {
  getResponsePlan: ({ personas }) => personas,
};

/**
 * Only the first actor responds.
 * Useful for testing or comparison with single-actor mode.
 */
export const singleActorOrchestrator: Orchestrator = {
  getResponsePlan: ({ personas }) => [personas[0]],
};
