import { ChatMessage } from "../../types";

export interface SubAgentDefinition {
  name: string;
  role: string;
  description: string;
  systemPrompt: string;
  allowedTools: string[];        // Subset of tools this agent can use
  maxIterations: number;         // Safety cap per sub-agent
  temperature?: number;          // Model temperature override
  model?: string;                // Optional model override
}

export interface SubAgentInstance {
  id: string;
  definition: SubAgentDefinition;
  status: "idle" | "running" | "completed" | "error";
  messages: ChatMessage[];       // Own conversation history
  result?: string;               // Final output
  startedAt: number;
  completedAt?: number;
  taskId?: string;
}

export interface AgentMessage {
  id: string;
  fromAgentId: string;
  toAgentId: string;             // 'orchestrator' for main agent
  type: "task" | "result" | "status" | "question";
  content: string;
  timestamp: number;
}
