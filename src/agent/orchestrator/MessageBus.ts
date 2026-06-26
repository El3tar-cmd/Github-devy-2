import { AgentMessage } from "../types/AgentTypes";

type MessageHandler = (message: AgentMessage) => void;

export class MessageBus {
  private handlers: Map<string, MessageHandler[]> = new Map();
  private messageLog: AgentMessage[] = [];

  subscribe(agentId: string, handler: MessageHandler) {
    const existing = this.handlers.get(agentId) || [];
    existing.push(handler);
    this.handlers.set(agentId, existing);
  }

  unsubscribe(agentId: string) {
    this.handlers.delete(agentId);
  }

  send(message: AgentMessage) {
    this.messageLog.push(message);
    const handlers = this.handlers.get(message.toAgentId) || [];
    handlers.forEach(h => h(message));
  }

  getLog(): AgentMessage[] {
    return [...this.messageLog];
  }

  clear() {
    this.messageLog = [];
    this.handlers.clear();
  }
}
