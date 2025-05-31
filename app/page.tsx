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
        <div className=" mx-auto px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="">
              <div className="bg-lime-300 w-36 h-6 -mb-6 rounded-lg"></div>
              <h2 className="font-semibold">Replay Protocol</h2>
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
          <TabsList className="grid w-[50vw] grid-cols-4 border border-gray-500">
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
            <Card className="border border-gray-500">
              <CardHeader>
                <CardTitle>
                  <div className="">
                    <div className="bg-sky-200 w-36 h-5 -mb-5 rounded-lg"></div>
                    <h2 className=" font-semibold">Agent Management</h2>
                  </div>
                </CardTitle>
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
            <Card className="border border-gray-500">
              <CardHeader>
                <CardTitle>
                  <div className="">
                    <div className="bg-sky-200 w-36 h-5 -mb-5 rounded-lg"></div>
                    <h2 className=" font-semibold">Provenance Graph</h2>
                  </div>
                </CardTitle>
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
            <Card className="border border-gray-500">
              <CardHeader>
                <CardTitle>
                  <div className="">
                    <div className="bg-sky-200 w-36 h-5 -mb-5 rounded-lg"></div>
                    <h2 className=" font-semibold">Activity Feed</h2>
                  </div>
                </CardTitle>
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
            <Card className="border border-gray-500">
              <CardHeader>
                <CardTitle>
                  <div className="">
                    <div className="bg-sky-200 w-36 h-5 -mb-5 rounded-lg"></div>
                    <h2 className=" font-semibold">Resource Graph </h2>
                  </div>
                </CardTitle>
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
