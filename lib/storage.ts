import type { Agent } from "@/types/agent";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "data");
const AGENTS_FILE = join(DATA_DIR, "agents.json");

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

class AgentStorage {
  private loadAgents(): Agent[] {
    try {
      if (existsSync(AGENTS_FILE)) {
        const data = readFileSync(AGENTS_FILE, "utf-8");
        return JSON.parse(data);
      }
    } catch (error) {
      console.error("Error loading agents:", error);
    }
    return [];
  }

  private saveAgents(agents: Agent[]): void {
    try {
      writeFileSync(AGENTS_FILE, JSON.stringify(agents, null, 2));
    } catch (error) {
      console.error("Error saving agents:", error);
    }
  }

  getAll(): Agent[] {
    return this.loadAgents();
  }

  getById(id: string): Agent | undefined {
    const agents = this.loadAgents();
    return agents.find((agent) => agent.id === id);
  }

  add(agent: Agent): void {
    const agents = this.loadAgents();
    agents.push(agent);
    this.saveAgents(agents);
  }

  remove(id: string): boolean {
    const agents = this.loadAgents();
    const index = agents.findIndex((agent) => agent.id === id);
    if (index !== -1) {
      agents.splice(index, 1);
      this.saveAgents(agents);
      return true;
    }
    return false;
  }

  update(id: string, updates: Partial<Agent>): Agent | null {
    const agents = this.loadAgents();
    const index = agents.findIndex((agent) => agent.id === id);
    if (index !== -1) {
      agents[index] = { ...agents[index], ...updates };
      this.saveAgents(agents);
      return agents[index];
    }
    return null;
  }
}

// Export a singleton instance
export const agentStorage = new AgentStorage();
