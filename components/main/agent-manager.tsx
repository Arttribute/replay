"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Plus, Bot, Trash2, MessageSquare } from "lucide-react";
import type { Agent, Tool } from "@/types/agent";
import { AgentChat } from "@/components/main/agent-chat";

const AVAILABLE_TOOLS: Tool[] = [
  {
    id: "text_generation",
    name: "Text Generation",
    description: "Generate text using GPT models",
    endpoint: "/api/llm/gpt",
    parameters: {
      type: "object",
      properties: {
        instruction: {
          type: "string",
          description: "The instruction for text generation",
        },
        inputs: { type: "string", description: "Input text" },
        outputs: { type: "string", description: "Expected output format" },
      },
      required: ["instruction", "inputs", "outputs"],
    },
  },
  {
    id: "image_generation",
    name: "Image Generation",
    description: "Generate images using DALL-E",
    endpoint: "/api/imagegen/dalle",
    parameters: {
      type: "object",
      properties: {
        input: { type: "string", description: "Image description prompt" },
      },
      required: ["input"],
    },
  },
  {
    id: "text_to_speech",
    name: "Text to Speech",
    description: "Convert text to speech audio",
    endpoint: "/api/voice/tts",
    parameters: {
      type: "object",
      properties: {
        input: { type: "string", description: "Text to convert to speech" },
      },
      required: ["input"],
    },
  },
  {
    id: "speech_to_text",
    name: "Speech to Text",
    description: "Convert speech audio to text",
    endpoint: "/api/voice/whisper",
    parameters: {
      type: "object",
      properties: {
        base64Audio: {
          type: "string",
          description: "Base64 encoded audio data",
        },
      },
      required: ["base64Audio"],
    },
  },
];

export function AgentManager() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [newAgent, setNewAgent] = useState({
    name: "",
    instructions: "",
    selectedTools: [] as string[],
  });
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      const response = await fetch("/api/agents");
      if (response.ok) {
        const data = await response.json();
        setAgents(data);
      }
    } catch (error) {
      console.error("Failed to load agents:", error);
    }
  };

  const createAgent = async () => {
    if (!newAgent.name || !newAgent.instructions) {
      alert("Please provide both name and instructions for the agent");
      return;
    }

    const selectedToolObjects = AVAILABLE_TOOLS.filter((tool) =>
      newAgent.selectedTools.includes(tool.id)
    );

    const agentData = {
      name: newAgent.name,
      instructions: newAgent.instructions,
      tools: selectedToolObjects,
    };

    try {
      setIsCreating(true);
      const response = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(agentData),
      });

      const responseData = await response.json();

      if (response.ok) {
        setAgents((prev) => [...prev, responseData]);
        setNewAgent({ name: "", instructions: "", selectedTools: [] });
        setIsCreateDialogOpen(false);
        console.log("Agent created successfully:", responseData);
      } else {
        console.error("Failed to create agent:", responseData.error);
        alert(`Failed to create agent: ${responseData.error}`);
      }
    } catch (error) {
      console.error("Failed to create agent:", error);
      alert(
        "Failed to create agent. Please check your network connection and try again."
      );
    } finally {
      setIsCreating(false);
    }
  };

  const deleteAgent = async (agentId: string) => {
    try {
      const response = await fetch(`/api/agents/${agentId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setAgents((prev) => prev.filter((agent) => agent.id !== agentId));
      }
    } catch (error) {
      console.error("Failed to delete agent:", error);
    }
  };

  const handleToolToggle = (toolId: string) => {
    setNewAgent((prev) => ({
      ...prev,
      selectedTools: prev.selectedTools.includes(toolId)
        ? prev.selectedTools.filter((id) => id !== toolId)
        : [...prev.selectedTools, toolId],
    }));
  };

  const openChat = (agent: Agent) => {
    setSelectedAgent(agent);
    setIsChatOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Active Agents</h3>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Agent
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Agent</DialogTitle>
              <DialogDescription>
                Configure your AI agent with custom instructions and tools
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="agent-name">Agent Name</Label>
                <Input
                  id="agent-name"
                  value={newAgent.name}
                  onChange={(e) =>
                    setNewAgent((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Enter agent name"
                />
              </div>
              <div>
                <Label htmlFor="agent-instructions">Instructions</Label>
                <Textarea
                  id="agent-instructions"
                  value={newAgent.instructions}
                  onChange={(e) =>
                    setNewAgent((prev) => ({
                      ...prev,
                      instructions: e.target.value,
                    }))
                  }
                  placeholder="Describe what this agent should do..."
                  rows={4}
                />
              </div>
              <div>
                <Label>Available Tools</Label>
                <ScrollArea className="h-48 border rounded-md p-4">
                  <div className="space-y-3">
                    {AVAILABLE_TOOLS.map((tool) => (
                      <div key={tool.id} className="flex items-start space-x-3">
                        <Checkbox
                          id={tool.id}
                          checked={newAgent.selectedTools.includes(tool.id)}
                          onCheckedChange={() => handleToolToggle(tool.id)}
                        />
                        <div className="flex-1">
                          <Label htmlFor={tool.id} className="font-medium">
                            {tool.name}
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            {tool.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={createAgent}
                  disabled={
                    !newAgent.name || !newAgent.instructions || isCreating
                  }
                >
                  Create Agent
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => (
          <Card key={agent.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Bot className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">{agent.name}</CardTitle>
                </div>
                <div className="flex space-x-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openChat(agent)}
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deleteAgent(agent.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <CardDescription className="text-sm">
                {agent.instructions}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium">Tools</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {agent.tools.map((tool) => (
                      <Badge
                        key={tool.id}
                        variant="secondary"
                        className="text-xs"
                      >
                        {tool.name}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Status: Active</span>
                  <span>
                    Created: {new Date(agent.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {agents.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bot className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Agents Created</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first AI agent to get started with dynamic tool
              calling and automation
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Agent
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={isChatOpen} onOpenChange={setIsChatOpen}>
        <DialogContent className="max-w-6xl h-[80vh]">
          <DialogHeader>
            <DialogTitle>Chat with {selectedAgent?.name}</DialogTitle>
            <DialogDescription>
              Interact with your agent and see tool calls in real-time
            </DialogDescription>
          </DialogHeader>
          {selectedAgent && (
            <ScrollArea className="h-90">
              <AgentChat
                agent={selectedAgent}
                onClose={() => setIsChatOpen(false)}
              />
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
