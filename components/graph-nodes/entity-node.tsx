"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Bot,
  User,
  Wrench,
  ImageIcon,
  Music,
  Video,
} from "lucide-react";
import type { Entity } from "@/types/provenance";

interface EntityNodeData {
  entity: Entity;
  attributions?: any[];
}

const getEntityIcon = (entity: Entity) => {
  if (entity.type === "ai") return <Bot className="h-4 w-4" />;
  if (entity.type === "human") return <User className="h-4 w-4" />;
  if (entity.type === "tool") return <Wrench className="h-4 w-4" />;

  // For resources, check the format
  const format = entity.metadata.format?.toLowerCase();
  if (
    format?.includes("image") ||
    ["png", "jpg", "jpeg", "gif", "svg"].includes(format)
  ) {
    return <ImageIcon className="h-4 w-4" />;
  }
  if (format?.includes("audio") || ["mp3", "wav", "ogg"].includes(format)) {
    return <Music className="h-4 w-4" />;
  }
  if (format?.includes("video") || ["mp4", "avi", "mov"].includes(format)) {
    return <Video className="h-4 w-4" />;
  }

  return <FileText className="h-4 w-4" />;
};

const getEntityColor = (type: string) => {
  switch (type) {
    case "resource":
      return "bg-blue-50 border-blue-200 hover:bg-blue-100";
    case "ai":
      return "bg-purple-50 border-purple-200 hover:bg-purple-100";
    case "human":
      return "bg-green-50 border-green-200 hover:bg-green-100";
    case "tool":
      return "bg-orange-50 border-orange-200 hover:bg-orange-100";
    default:
      return "bg-gray-50 border-gray-200 hover:bg-gray-100";
  }
};

const getTypeColor = (type: string) => {
  switch (type) {
    case "resource":
      return "bg-blue-100 text-blue-800";
    case "ai":
      return "bg-purple-100 text-purple-800";
    case "human":
      return "bg-green-100 text-green-800";
    case "tool":
      return "bg-orange-100 text-orange-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

export const EntityNode = memo(
  ({ data, selected }: NodeProps<EntityNodeData>) => {
    const { entity, attributions } = data;
    const displayName =
      entity.metadata.name ||
      entity.metadata.title ||
      entity.id.split(":")[1] ||
      entity.id;

    return (
      <div className="relative">
        <Handle type="target" position={Position.Top} className="w-3 h-3" />
        <Handle type="source" position={Position.Bottom} className="w-3 h-3" />

        <Card
          className={`
        w-48 transition-all duration-200 cursor-pointer
        ${getEntityColor(entity.type)}
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
                {getEntityIcon(entity)}
                <Badge
                  variant="secondary"
                  className={`text-xs ${getTypeColor(entity.type)}`}
                >
                  {entity.type}
                </Badge>
              </div>
              {attributions && attributions.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  {attributions.length}
                </Badge>
              )}
            </div>

            <div className="space-y-1">
              <div className="font-medium text-sm truncate" title={displayName}>
                {displayName}
              </div>

              {entity.metadata.format && (
                <div className="text-xs text-muted-foreground">
                  {entity.metadata.format}
                </div>
              )}

              {entity.metadata.createdAt && (
                <div className="text-xs text-muted-foreground">
                  {new Date(entity.metadata.createdAt).toLocaleDateString()}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
);

EntityNode.displayName = "EntityNode";
