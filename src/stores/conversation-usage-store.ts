import { create } from 'zustand';

interface ConversationUsageState {
  conversationId: string | null;
  cost: number;
  inputTokens: number;
  outputTokens: number;

  // Actions
  setUsage: (
    conversationId: string,
    cost: number,
    inputTokens: number,
    outputTokens: number
  ) => void;
  addUsage: (cost: number, inputTokens: number, outputTokens: number) => void;
  resetUsage: (conversationId?: string) => void;
}

export const useConversationUsageStore = create<ConversationUsageState>((set) => ({
  conversationId: null,
  cost: 0,
  inputTokens: 0,
  outputTokens: 0,

  setUsage: (conversationId, cost, inputTokens, outputTokens) =>
    set({ conversationId, cost, inputTokens, outputTokens }),

  addUsage: (cost, inputTokens, outputTokens) =>
    set((state) => ({
      cost: state.cost + cost,
      inputTokens: state.inputTokens + inputTokens,
      outputTokens: state.outputTokens + outputTokens,
    })),

  resetUsage: (conversationId) =>
    set({ conversationId: conversationId ?? null, cost: 0, inputTokens: 0, outputTokens: 0 }),
}));
