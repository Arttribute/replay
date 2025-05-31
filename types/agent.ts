export interface Tool {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

export interface Agent {
  id: string;
  name: string;
  instructions: string;
  tools: Tool[];
  assistantId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
  result?: any;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  toolCalls?: ToolCall[];
}

export interface AgentConversation {
  id: string;
  agentId: string;
  threadId: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}
