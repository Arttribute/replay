"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  RefreshCw,
  Link,
  CheckCircle,
  UserCheck,
  Zap,
} from "lucide-react";
import type { Activity } from "@/types/provenance";

interface ActivityNodeData {
  activity: Activity;
}

const getActivityIcon = (type: string) => {
  switch (type) {
    case "generate":
      return <Plus className="h-4 w-4" />;
    case "transform":
      return <RefreshCw className="h-4 w-4" />;
    case "reference":
      return <Link className="h-4 w-4" />;
    case "approve":
      return <CheckCircle className="h-4 w-4" />;
    case "assign":
      return <UserCheck className="h-4 w-4" />;
    default:
      return <Zap className="h-4 w-4" />;
  }
};

const getActivityColor = (type: string) => {
  switch (type) {
    case "generate":
      return "bg-green-50 border-green-200 hover:bg-green-100";
    case "transform":
      return "bg-blue-50 border-blue-200 hover:bg-blue-100";
    case "reference":
      return "bg-orange-50 border-orange-200 hover:bg-orange-100";
    case "approve":
      return "bg-purple-50 border-purple-200 hover:bg-purple-100";
    case "assign":
      return "bg-gray-50 border-gray-200 hover:bg-gray-100";
    default:
      return "bg-gray-50 border-gray-200 hover:bg-gray-100";
  }
};

const getTypeColor = (type: string) => {
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

export const ActivityNode = memo(
  ({ data, selected }: NodeProps<ActivityNodeData>) => {
    const { activity } = data;
    const performerName =
      activity.performedBy.split(":")[1] || activity.performedBy;

    return (
      <div className="relative">
        <Handle type="target" position={Position.Top} className="w-3 h-3" />
        <Handle type="source" position={Position.Bottom} className="w-3 h-3" />

        <Card
          className={`
        w-52 transition-all duration-200 cursor-pointer
        ${getActivityColor(activity.type)}
        ${
          selected
            ? "ring-2 ring-blue-500 shadow-lg"
            : "shadow-sm hover:shadow-md"
        }
      `}
        >
          <CardContent className="p-3">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center space-x-2">
                {getActivityIcon(activity.type)}
                <Badge
                  variant="secondary"
                  className={`text-xs ${getTypeColor(activity.type)}`}
                >
                  {activity.type}
                </Badge>
              </div>
              <div className="flex space-x-1">
                {activity.inputs.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {activity.inputs.length} in
                  </Badge>
                )}
                {activity.outputs.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {activity.outputs.length} out
                  </Badge>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <div
                className="font-medium text-sm truncate"
                title={performerName}
              >
                {performerName}
              </div>

              <div className="text-xs text-muted-foreground">
                {new Date(activity.timestamp).toLocaleString()}
              </div>

              {activity.metadata?.task && (
                <div
                  className="text-xs text-muted-foreground truncate"
                  title={activity.metadata.task}
                >
                  {activity.metadata.task}
                </div>
              )}

              {activity.metadata?.toolUsed && (
                <Badge variant="outline" className="text-xs">
                  {activity.metadata.toolUsed}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
);

ActivityNode.displayName = "ActivityNode";
