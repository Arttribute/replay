"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  Clock,
  User,
  Bot,
  PenToolIcon as Tool,
  FileText,
} from "lucide-react";
import type { Activity } from "@/types/provenance";

export function ActivityFeed() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadActivities();
    const interval = setInterval(loadActivities, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const loadActivities = async () => {
    try {
      const response = await fetch("/api/provenance/activities");
      if (response.ok) {
        const data = await response.json();
        setActivities(
          data.sort(
            (a: Activity, b: Activity) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )
        );
      }
    } catch (error) {
      console.error("Failed to load activities:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "generate":
        return <FileText className="h-4 w-4" />;
      case "transform":
        return <Tool className="h-4 w-4" />;
      case "reference":
        return <FileText className="h-4 w-4" />;
      case "approve":
        return <User className="h-4 w-4" />;
      case "assign":
        return <Bot className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case "generate":
        return "bg-green-100 text-green-800";
      case "transform":
        return "bg-blue-100 text-blue-800";
      case "reference":
        return "bg-orange-100 text-orange-800";
      case "approve":
        return "bg-purple-100 text-purple-800";
      case "assign":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Recent Activities</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={loadActivities}
          disabled={isLoading}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      <ScrollArea className="h-[600px]">
        <div className="space-y-4">
          {activities.map((activity) => (
            <Card key={activity.id}>
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  <div
                    className={`p-2 rounded-full ${getActivityColor(
                      activity.type
                    )}`}
                  >
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Badge
                          variant="outline"
                          className={getActivityColor(activity.type)}
                        >
                          {activity.type}
                        </Badge>
                        <span className="text-sm font-medium">
                          {activity.performedBy}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatTimestamp(activity.timestamp)}
                      </span>
                    </div>

                    {activity.metadata && (
                      <div className="text-sm text-muted-foreground">
                        {activity.metadata.task && (
                          <p>
                            <strong>Task:</strong> {activity.metadata.task}
                          </p>
                        )}
                        {activity.metadata.toolUsed && (
                          <p>
                            <strong>Tool:</strong> {activity.metadata.toolUsed}
                          </p>
                        )}
                        {activity.metadata.modelVersion && (
                          <p>
                            <strong>Model:</strong>{" "}
                            {activity.metadata.modelVersion}
                          </p>
                        )}
                        {activity.metadata.note && (
                          <p>
                            <strong>Note:</strong> {activity.metadata.note}
                          </p>
                        )}
                      </div>
                    )}

                    {activity.inputs.length > 0 && (
                      <div className="text-sm">
                        <strong>Inputs:</strong>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {activity.inputs.map((input) => (
                            <Badge
                              key={input}
                              variant="secondary"
                              className="text-xs"
                            >
                              {input}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {activity.outputs.length > 0 && (
                      <div className="text-sm">
                        <strong>Outputs:</strong>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {activity.outputs.map((output) => (
                            <Badge
                              key={output}
                              variant="outline"
                              className="text-xs"
                            >
                              {output}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {activity.signedBy && (
                      <div className="text-xs text-muted-foreground">
                        <strong>Signed by:</strong> {activity.signedBy}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {activities.length === 0 && !isLoading && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  No Activities Yet
                </h3>
                <p className="text-muted-foreground text-center">
                  Start interacting with agents to see activity history here
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
