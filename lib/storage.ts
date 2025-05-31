import type { Agent } from "@/types/agent";

// Simple in-memory storage - replace with database in production
class AgentStorage {
  private agents: Agent[] = [];

  getAll(): Agent[] {
    return this.agents;
  }

  getById(id: string): Agent | undefined {
    return this.agents.find((agent) => agent.id === id);
  }

  add(agent: Agent): void {
    this.agents.push(agent);
  }

  remove(id: string): boolean {
    const index = this.agents.findIndex((agent) => agent.id === id);
    if (index !== -1) {
      this.agents.splice(index, 1);
      return true;
    }
    return false;
  }

  update(id: string, updates: Partial<Agent>): Agent | null {
    const index = this.agents.findIndex((agent) => agent.id === id);
    if (index !== -1) {
      this.agents[index] = { ...this.agents[index], ...updates };
      return this.agents[index];
    }
    return null;
  }
}

// Export a singleton instance
export const agentStorage = new AgentStorage();
