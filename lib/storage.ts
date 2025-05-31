import type { Agent } from "@/types/agent";
import type { ChatMessage } from "@/types/agent";
import type { Entity, Activity, Attribution } from "@/types/provenance";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "data");
const AGENTS_FILE = join(DATA_DIR, "agents.json");
const CHATS_FILE = join(DATA_DIR, "chats.json");
const ENTITIES_FILE = join(DATA_DIR, "entities.json");
const ACTIVITIES_FILE = join(DATA_DIR, "activities.json");
const ATTRIBUTIONS_FILE = join(DATA_DIR, "attributions.json");

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

// Agent Storage
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

// Chat Storage
interface ChatThread {
  id: string;
  agentId: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

class ChatStorage {
  private loadChats(): Record<string, ChatThread> {
    try {
      if (existsSync(CHATS_FILE)) {
        const data = readFileSync(CHATS_FILE, "utf-8");
        return JSON.parse(data);
      }
    } catch (error) {
      console.error("Error loading chats:", error);
    }
    return {};
  }

  private saveChats(chats: Record<string, ChatThread>): void {
    try {
      writeFileSync(CHATS_FILE, JSON.stringify(chats, null, 2));
    } catch (error) {
      console.error("Error saving chats:", error);
    }
  }

  getThread(threadId: string): ChatThread | null {
    const chats = this.loadChats();
    return chats[threadId] || null;
  }

  createThread(agentId: string, threadId: string): ChatThread {
    const chats = this.loadChats();
    const now = new Date().toISOString();

    const thread: ChatThread = {
      id: threadId,
      agentId,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };

    chats[threadId] = thread;
    this.saveChats(chats);
    return thread;
  }

  addMessage(threadId: string, message: ChatMessage): void {
    const chats = this.loadChats();
    if (!chats[threadId]) {
      throw new Error(`Thread ${threadId} not found`);
    }

    chats[threadId].messages.push(message);
    chats[threadId].updatedAt = new Date().toISOString();
    this.saveChats(chats);
  }

  getThreadsByAgentId(agentId: string): ChatThread[] {
    const chats = this.loadChats();
    return Object.values(chats).filter((thread) => thread.agentId === agentId);
  }

  getAllThreads(): ChatThread[] {
    const chats = this.loadChats();
    return Object.values(chats);
  }
}

// Provenance Storage
class ProvenanceStorage {
  // Entities
  private loadEntities(): Entity[] {
    try {
      if (existsSync(ENTITIES_FILE)) {
        const data = readFileSync(ENTITIES_FILE, "utf-8");
        return JSON.parse(data);
      }
    } catch (error) {
      console.error("Error loading entities:", error);
    }
    return [];
  }

  private saveEntities(entities: Entity[]): void {
    try {
      writeFileSync(ENTITIES_FILE, JSON.stringify(entities, null, 2));
    } catch (error) {
      console.error("Error saving entities:", error);
    }
  }

  // Activities
  private loadActivities(): Activity[] {
    try {
      if (existsSync(ACTIVITIES_FILE)) {
        const data = readFileSync(ACTIVITIES_FILE, "utf-8");
        return JSON.parse(data);
      }
    } catch (error) {
      console.error("Error loading activities:", error);
    }
    return [];
  }

  private saveActivities(activities: Activity[]): void {
    try {
      writeFileSync(ACTIVITIES_FILE, JSON.stringify(activities, null, 2));
    } catch (error) {
      console.error("Error saving activities:", error);
    }
  }

  // Attributions
  private loadAttributions(): Attribution[] {
    try {
      if (existsSync(ATTRIBUTIONS_FILE)) {
        const data = readFileSync(ATTRIBUTIONS_FILE, "utf-8");
        return JSON.parse(data);
      }
    } catch (error) {
      console.error("Error loading attributions:", error);
    }
    return [];
  }

  private saveAttributions(attributions: Attribution[]): void {
    try {
      writeFileSync(ATTRIBUTIONS_FILE, JSON.stringify(attributions, null, 2));
    } catch (error) {
      console.error("Error saving attributions:", error);
    }
  }

  // Entity methods
  getEntities(): Entity[] {
    return this.loadEntities();
  }

  getEntityById(id: string): Entity | undefined {
    return this.loadEntities().find((entity) => entity.id === id);
  }

  addEntity(entity: Entity): void {
    const entities = this.loadEntities();
    entities.push(entity);
    this.saveEntities(entities);
  }

  // Activity methods
  getActivities(): Activity[] {
    return this.loadActivities();
  }

  getActivityById(id: string): Activity | undefined {
    return this.loadActivities().find((activity) => activity.id === id);
  }

  addActivity(activity: Activity): void {
    const activities = this.loadActivities();
    activities.push(activity);
    this.saveActivities(activities);
  }

  // Attribution methods
  getAttributions(): Attribution[] {
    return this.loadAttributions();
  }

  getAttributionsForResource(resourceId: string): Attribution[] {
    return this.loadAttributions().filter(
      (attr) => attr.resourceId === resourceId
    );
  }

  addAttribution(attribution: Attribution): void {
    const attributions = this.loadAttributions();
    attributions.push(attribution);
    this.saveAttributions(attributions);
  }

  // Utility methods
  generateResourceId(type: string, name?: string): string {
    const timestamp = Date.now();
    const suffix = name ? `-${name.toLowerCase().replace(/\s+/g, "-")}` : "";
    return `${type}:${timestamp}${suffix}`;
  }

  generateActivityId(type: string): string {
    const timestamp = Date.now();
    return `activity:${type}-${timestamp}`;
  }
}

// Export singleton instances
export const agentStorage = new AgentStorage();
export const chatStorage = new ChatStorage();
export const provenanceStorage = new ProvenanceStorage();
