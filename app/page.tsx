"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentManager } from "@/components/main/agent-manager";
import { ProvenanceGraph } from "@/components/main/provenance-graph";
import { ActivityFeed } from "@/components/main/activity-feed";
import { ResourceLibrary } from "@/components/main/resource-library";
import { Bot, Network, Activity, FolderOpen } from "lucide-react";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState("agents");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bot className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold">AI Agent System</h1>
            </div>
            <div className="text-sm text-muted-foreground">
              Dynamic Multi-Agent Platform with Provenance Tracking
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="agents" className="flex items-center space-x-2">
              <Bot className="h-4 w-4" />
              <span>Agents</span>
            </TabsTrigger>
            <TabsTrigger
              value="provenance"
              className="flex items-center space-x-2"
            >
              <Network className="h-4 w-4" />
              <span>Provenance</span>
            </TabsTrigger>
            <TabsTrigger
              value="activity"
              className="flex items-center space-x-2"
            >
              <Activity className="h-4 w-4" />
              <span>Activity</span>
            </TabsTrigger>
            <TabsTrigger
              value="resources"
              className="flex items-center space-x-2"
            >
              <FolderOpen className="h-4 w-4" />
              <span>Resources</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="agents" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Agent Management</CardTitle>
                <CardDescription>
                  Create and manage AI agents with custom instructions and
                  dynamic tool capabilities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AgentManager />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="provenance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Provenance Graph</CardTitle>
                <CardDescription>
                  Visualize the creation and transformation history of all
                  resources
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ProvenanceGraph />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Activity Feed</CardTitle>
                <CardDescription>
                  Real-time feed of all agent activities and interactions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ActivityFeed />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="resources" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Resource Library</CardTitle>
                <CardDescription>
                  Browse and manage all generated resources with attribution
                  details
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResourceLibrary />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
