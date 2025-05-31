"use client";

import type React from "react";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  RefreshCw,
  Download,
  Filter,
  ZoomIn,
  ZoomOut,
  Maximize2,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Entity, Activity, Attribution } from "@/types/provenance";

interface GraphNode {
  id: string;
  type: "entity" | "activity";
  x: number;
  y: number;
  data: Entity | Activity;
  attributions?: Attribution[];
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: "input" | "output";
}

interface GraphFilters {
  entityTypes: string[];
  activityTypes: string[];
  dateRange: {
    start: string;
    end: string;
  };
  searchTerm: string;
}

interface ProvenanceGraphProps {
  focusedResourceId?: string | null;
}

export function ProvenanceGraph({ focusedResourceId }: ProvenanceGraphProps) {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [attributions, setAttributions] = useState<Attribution[]>([]);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(
    null
  );
  const svgRef = useRef<SVGSVGElement>(null);
  const [filters, setFilters] = useState<GraphFilters>({
    entityTypes: ["resource", "ai", "human", "tool"],
    activityTypes: ["generate", "transform", "reference", "approve", "assign"],
    dateRange: { start: "", end: "" },
    searchTerm: "",
  });
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);

  useEffect(() => {
    loadProvenanceData();
  }, []);

  useEffect(() => {
    if (focusedResourceId) {
      setSelectedResourceId(focusedResourceId);
    }
  }, [focusedResourceId]);

  useEffect(() => {
    if (entities.length > 0 || activities.length > 0) {
      generateGraph();
    }
  }, [entities, activities, attributions, filters, selectedResourceId]);

  const loadProvenanceData = async () => {
    try {
      setIsLoading(true);
      const [entitiesRes, activitiesRes, attributionsRes] = await Promise.all([
        fetch("/api/provenance/entities"),
        fetch("/api/provenance/activities"),
        fetch("/api/provenance/attributions"),
      ]);

      if (entitiesRes.ok && activitiesRes.ok && attributionsRes.ok) {
        const [entitiesData, activitiesData, attributionsData] =
          await Promise.all([
            entitiesRes.json(),
            activitiesRes.json(),
            attributionsRes.json(),
          ]);

        setEntities(entitiesData);
        setActivities(activitiesData);
        setAttributions(attributionsData);
      }
    } catch (error) {
      console.error("Failed to load provenance data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getRelatedActivities = (resourceId: string): Activity[] => {
    return activities.filter(
      (activity) =>
        activity.inputs.includes(resourceId) ||
        activity.outputs.includes(resourceId)
    );
  };

  const getRelatedEntities = (relatedActivities: Activity[]): string[] => {
    const entityIds = new Set<string>();

    relatedActivities.forEach((activity) => {
      activity.inputs.forEach((input) => entityIds.add(input));
      activity.outputs.forEach((output) => entityIds.add(output));
      entityIds.add(activity.performedBy);
    });

    return Array.from(entityIds);
  };

  const generateGraph = () => {
    let filteredEntities = entities.filter((entity) => {
      const matchesType = filters.entityTypes.includes(entity.type);
      const matchesSearch =
        !filters.searchTerm ||
        entity.id.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        entity.metadata.name
          ?.toLowerCase()
          .includes(filters.searchTerm.toLowerCase());
      return matchesType && matchesSearch;
    });

    let filteredActivities = activities.filter((activity) => {
      const matchesType = filters.activityTypes.includes(activity.type);
      const matchesSearch =
        !filters.searchTerm ||
        activity.id.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        activity.performedBy
          .toLowerCase()
          .includes(filters.searchTerm.toLowerCase());
      const matchesDate =
        (!filters.dateRange.start ||
          activity.timestamp >= filters.dateRange.start) &&
        (!filters.dateRange.end || activity.timestamp <= filters.dateRange.end);
      return matchesType && matchesSearch && matchesDate;
    });

    // If a specific resource is selected, filter to show only related items
    if (selectedResourceId) {
      const relatedActivities = getRelatedActivities(selectedResourceId);
      const relatedEntityIds = getRelatedEntities(relatedActivities);

      filteredActivities = relatedActivities.filter((activity) =>
        filteredActivities.some((fa) => fa.id === activity.id)
      );
      filteredEntities = filteredEntities.filter((entity) =>
        relatedEntityIds.includes(entity.id)
      );
    }

    // Create nodes with better positioning
    const entityNodes: GraphNode[] = filteredEntities.map((entity, index) => {
      const isSelected = entity.id === selectedResourceId;
      return {
        id: entity.id,
        type: "entity",
        x: isSelected ? 400 : (index % 6) * 200 + 100,
        y: isSelected ? 200 : Math.floor(index / 6) * 120 + 50,
        data: entity,
        attributions: attributions.filter(
          (attr) => attr.resourceId === entity.id
        ),
      };
    });

    const activityNodes: GraphNode[] = filteredActivities.map(
      (activity, index) => ({
        id: activity.id,
        type: "activity",
        x: (index % 5) * 220 + 150,
        y: Math.floor(index / 5) * 140 + 250,
        data: activity,
      })
    );

    // Create edges
    const graphEdges: GraphEdge[] = [];

    filteredActivities.forEach((activity) => {
      // Input edges
      activity.inputs.forEach((inputId) => {
        if (
          filteredEntities.some((e) => e.id === inputId) ||
          filteredActivities.some((a) => a.id === inputId)
        ) {
          graphEdges.push({
            id: `${inputId}-${activity.id}`,
            source: inputId,
            target: activity.id,
            type: "input",
          });
        }
      });

      // Output edges
      activity.outputs.forEach((outputId) => {
        if (filteredEntities.some((e) => e.id === outputId)) {
          graphEdges.push({
            id: `${activity.id}-${outputId}`,
            source: activity.id,
            target: outputId,
            type: "output",
          });
        }
      });
    });

    setNodes([...entityNodes, ...activityNodes]);
    setEdges(graphEdges);
  };

  const getNodePosition = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    return node ? { x: node.x, y: node.y } : { x: 0, y: 0 };
  };

  const getEntityColor = (type: string) => {
    switch (type) {
      case "resource":
        return "#dbeafe";
      case "ai":
        return "#f3e8ff";
      case "human":
        return "#dcfce7";
      case "tool":
        return "#fed7aa";
      default:
        return "#f1f5f9";
    }
  };

  const getEntityBorderColor = (type: string, isSelected = false) => {
    const baseColor = (() => {
      switch (type) {
        case "resource":
          return "#3b82f6";
        case "ai":
          return "#8b5cf6";
        case "human":
          return "#10b981";
        case "tool":
          return "#f97316";
        default:
          return "#64748b";
      }
    })();
    return isSelected ? "#ef4444" : baseColor;
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case "generate":
        return "#10b981";
      case "transform":
        return "#3b82f6";
      case "reference":
        return "#f97316";
      case "approve":
        return "#8b5cf6";
      case "assign":
        return "#64748b";
      default:
        return "#6b7280";
    }
  };

  const handleNodeClick = (node: GraphNode) => {
    setSelectedNode(node);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === svgRef.current) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) {
        setPan({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
      }
    },
    [isDragging, dragStart]
  );

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(prev * 1.2, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev / 1.2, 0.3));
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const clearResourceFocus = () => {
    setSelectedResourceId(null);
  };

  const exportGraph = () => {
    const graphData = {
      nodes: nodes.map((node) => ({
        id: node.id,
        type: node.type,
        position: { x: node.x, y: node.y },
        data: node.data,
      })),
      edges: edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type,
      })),
      metadata: {
        exportedAt: new Date().toISOString(),
        totalEntities: entities.length,
        totalActivities: activities.length,
        totalAttributions: attributions.length,
        focusedResource: selectedResourceId,
      },
    };

    const blob = new Blob([JSON.stringify(graphData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `provenance-graph-${
      selectedResourceId ? `${selectedResourceId}-` : ""
    }${new Date().toISOString().split("T")[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const resetFilters = () => {
    setFilters({
      entityTypes: ["resource", "ai", "human", "tool"],
      activityTypes: [
        "generate",
        "transform",
        "reference",
        "approve",
        "assign",
      ],
      dateRange: { start: "", end: "" },
      searchTerm: "",
    });
  };

  const resourceEntities = entities.filter(
    (entity) => entity.type === "resource"
  );

  return (
    <div className="space-y-6">
      {/* Resource Focus Section */}
      {selectedResourceId && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="bg-blue-100 text-blue-800">
                  Focused View
                </Badge>
                <span className="font-medium">
                  {entities.find((e) => e.id === selectedResourceId)?.metadata
                    .title ||
                    entities.find((e) => e.id === selectedResourceId)?.metadata
                      .name ||
                    selectedResourceId}
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={clearResourceFocus}>
                <X className="h-4 w-4 mr-2" />
                Show All
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Showing provenance graph for the selected resource and all related
              activities and entities.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadProvenanceData}
            disabled={isLoading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>

          {/* Resource Selector */}
          <Select
            value={selectedResourceId || "all"}
            onValueChange={(value) =>
              setSelectedResourceId(value === "all" ? null : value)
            }
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Focus on specific resource..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Resources</SelectItem>
              {resourceEntities.map((resource) => (
                <SelectItem key={resource.id} value={resource.id}>
                  {resource.metadata.title ||
                    resource.metadata.name ||
                    resource.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Dialog
            open={isFilterDialogOpen}
            onOpenChange={setIsFilterDialogOpen}
          >
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Graph Filters</DialogTitle>
                <DialogDescription>
                  Customize what appears in the provenance graph
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Search</Label>
                  <Input
                    placeholder="Search nodes..."
                    value={filters.searchTerm}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        searchTerm: e.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <Label>Entity Types</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {["resource", "ai", "human", "tool"].map((type) => (
                      <div key={type} className="flex items-center space-x-2">
                        <Checkbox
                          id={`entity-${type}`}
                          checked={filters.entityTypes.includes(type)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setFilters((prev) => ({
                                ...prev,
                                entityTypes: [...prev.entityTypes, type],
                              }));
                            } else {
                              setFilters((prev) => ({
                                ...prev,
                                entityTypes: prev.entityTypes.filter(
                                  (t) => t !== type
                                ),
                              }));
                            }
                          }}
                        />
                        <Label
                          htmlFor={`entity-${type}`}
                          className="capitalize"
                        >
                          {type}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Activity Types</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {[
                      "generate",
                      "transform",
                      "reference",
                      "approve",
                      "assign",
                    ].map((type) => (
                      <div key={type} className="flex items-center space-x-2">
                        <Checkbox
                          id={`activity-${type}`}
                          checked={filters.activityTypes.includes(type)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setFilters((prev) => ({
                                ...prev,
                                activityTypes: [...prev.activityTypes, type],
                              }));
                            } else {
                              setFilters((prev) => ({
                                ...prev,
                                activityTypes: prev.activityTypes.filter(
                                  (t) => t !== type
                                ),
                              }));
                            }
                          }}
                        />
                        <Label
                          htmlFor={`activity-${type}`}
                          className="capitalize"
                        >
                          {type}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    onClick={resetFilters}
                    className="flex-1"
                  >
                    Reset
                  </Button>
                  <Button
                    onClick={() => setIsFilterDialogOpen(false)}
                    className="flex-1"
                  >
                    Apply
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button variant="outline" size="sm" onClick={handleZoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleZoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>

        <Button variant="outline" size="sm" onClick={exportGraph}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Interactive Provenance Graph</CardTitle>
              <CardDescription>
                {selectedResourceId
                  ? "Focused view showing the complete provenance of the selected resource"
                  : "Explore the relationships between entities and activities. Click nodes for details, drag to pan."}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[700px] border rounded-lg overflow-hidden bg-gray-50 relative">
                <svg
                  ref={svgRef}
                  width="100%"
                  height="100%"
                  className="cursor-move"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  <defs>
                    <pattern
                      id="grid"
                      width="20"
                      height="20"
                      patternUnits="userSpaceOnUse"
                    >
                      <path
                        d="M 20 0 L 0 0 0 20"
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth="1"
                      />
                    </pattern>
                    <marker
                      id="arrowhead"
                      markerWidth="10"
                      markerHeight="7"
                      refX="9"
                      refY="3.5"
                      orient="auto"
                      fill="#64748b"
                    >
                      <polygon points="0 0, 10 3.5, 0 7" />
                    </marker>
                    <marker
                      id="arrowhead-green"
                      markerWidth="10"
                      markerHeight="7"
                      refX="9"
                      refY="3.5"
                      orient="auto"
                      fill="#059669"
                    >
                      <polygon points="0 0, 10 3.5, 0 7" />
                    </marker>
                  </defs>

                  <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                    <rect width="2000" height="2000" fill="url(#grid)" />

                    {/* Render edges */}
                    {edges.map((edge) => {
                      const sourcePos = getNodePosition(edge.source);
                      const targetPos = getNodePosition(edge.target);
                      const isOutput = edge.type === "output";

                      return (
                        <line
                          key={edge.id}
                          x1={sourcePos.x + 80}
                          y1={sourcePos.y + 40}
                          x2={targetPos.x + 80}
                          y2={targetPos.y + 40}
                          stroke={isOutput ? "#059669" : "#64748b"}
                          strokeWidth="2"
                          markerEnd={
                            isOutput
                              ? "url(#arrowhead-green)"
                              : "url(#arrowhead)"
                          }
                          opacity="0.7"
                        />
                      );
                    })}

                    {/* Render nodes */}
                    {nodes.map((node) => {
                      const isSelected = selectedNode?.id === node.id;
                      const isFocused = node.id === selectedResourceId;

                      if (node.type === "entity") {
                        const entity = node.data as Entity;
                        const displayName =
                          entity.metadata.name ||
                          entity.metadata.title ||
                          entity.id.split(":")[1] ||
                          entity.id;

                        return (
                          <g
                            key={node.id}
                            transform={`translate(${node.x}, ${node.y})`}
                          >
                            <rect
                              width="160"
                              height="80"
                              rx="8"
                              fill={getEntityColor(entity.type)}
                              stroke={getEntityBorderColor(
                                entity.type,
                                isFocused
                              )}
                              strokeWidth={
                                isSelected ? "3" : isFocused ? "4" : "2"
                              }
                              className="cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => handleNodeClick(node)}
                            />
                            {isFocused && (
                              <rect
                                width="160"
                                height="80"
                                rx="8"
                                fill="none"
                                stroke="#ef4444"
                                strokeWidth="2"
                                strokeDasharray="5,5"
                                className="animate-pulse"
                              />
                            )}
                            <text
                              x="80"
                              y="25"
                              textAnchor="middle"
                              className="text-sm font-medium fill-gray-800"
                              style={{ fontSize: "12px" }}
                            >
                              {displayName.length > 18
                                ? `${displayName.substring(0, 15)}...`
                                : displayName}
                            </text>
                            <text
                              x="80"
                              y="45"
                              textAnchor="middle"
                              className="text-xs fill-gray-600"
                              style={{ fontSize: "10px" }}
                            >
                              {entity.type}
                            </text>
                            {entity.metadata.format && (
                              <text
                                x="80"
                                y="60"
                                textAnchor="middle"
                                className="text-xs fill-gray-500"
                                style={{ fontSize: "9px" }}
                              >
                                {entity.metadata.format}
                              </text>
                            )}
                            {node.attributions &&
                              node.attributions.length > 0 && (
                                <circle cx="145" cy="15" r="8" fill="#3b82f6" />
                              )}
                          </g>
                        );
                      } else {
                        const activity = node.data as Activity;
                        const performerName =
                          activity.performedBy.split(":")[1] ||
                          activity.performedBy;

                        return (
                          <g
                            key={node.id}
                            transform={`translate(${node.x}, ${node.y})`}
                          >
                            <polygon
                              points="80,10 140,40 80,70 20,40"
                              fill={getActivityColor(activity.type)}
                              stroke="#374151"
                              strokeWidth={isSelected ? "3" : "2"}
                              className="cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => handleNodeClick(node)}
                            />
                            <text
                              x="80"
                              y="35"
                              textAnchor="middle"
                              className="text-xs font-medium fill-white"
                              style={{ fontSize: "10px" }}
                            >
                              {activity.type}
                            </text>
                            <text
                              x="80"
                              y="50"
                              textAnchor="middle"
                              className="text-xs fill-white"
                              style={{ fontSize: "8px" }}
                            >
                              {performerName.length > 12
                                ? `${performerName.substring(0, 9)}...`
                                : performerName}
                            </text>
                          </g>
                        );
                      }
                    })}
                  </g>
                </svg>

                {/* Zoom indicator */}
                <div className="absolute top-4 left-4 bg-white p-2 rounded-lg shadow-sm border text-xs">
                  <div className="font-medium mb-1">Graph View</div>
                  <div>Zoom: {Math.round(zoom * 100)}%</div>
                  <div>Nodes: {nodes.length}</div>
                  <div>Edges: {edges.length}</div>
                  {selectedResourceId && (
                    <div className="text-blue-600 font-medium">
                      Focused Mode
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {selectedNode && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Node Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedNode.type === "entity" && (
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <Badge variant="outline">
                        {(selectedNode.data as Entity).type}
                      </Badge>
                      {selectedNode.id === selectedResourceId && (
                        <Badge
                          variant="outline"
                          className="bg-red-100 text-red-800"
                        >
                          Focused
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-2 text-sm">
                      <div>
                        <strong>ID:</strong> {selectedNode.data.id}
                      </div>
                      {(selectedNode.data as Entity).metadata.name && (
                        <div>
                          <strong>Name:</strong>{" "}
                          {(selectedNode.data as Entity).metadata.name}
                        </div>
                      )}
                      {(selectedNode.data as Entity).metadata.format && (
                        <div>
                          <strong>Format:</strong>{" "}
                          {(selectedNode.data as Entity).metadata.format}
                        </div>
                      )}
                      {(selectedNode.data as Entity).metadata.createdAt && (
                        <div>
                          <strong>Created:</strong>{" "}
                          {new Date(
                            (selectedNode.data as Entity).metadata.createdAt
                          ).toLocaleString()}
                        </div>
                      )}
                    </div>

                    {selectedNode.attributions &&
                      selectedNode.attributions.length > 0 && (
                        <div>
                          <Separator className="my-2" />
                          <div className="text-sm">
                            <strong>Contributors:</strong>
                            <div className="mt-1 space-y-1">
                              {selectedNode.attributions.map((attr, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between"
                                >
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {attr.role}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {attr.weight &&
                                      `${Math.round(attr.weight * 100)}%`}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                    {selectedNode.type === "entity" &&
                      (selectedNode.data as Entity).type === "resource" && (
                        <div>
                          <Separator className="my-2" />
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full"
                            onClick={() =>
                              setSelectedResourceId(selectedNode.id)
                            }
                          >
                            Focus on This Resource
                          </Button>
                        </div>
                      )}
                  </div>
                )}

                {selectedNode.type === "activity" && (
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <Badge variant="outline">
                        {(selectedNode.data as Activity).type}
                      </Badge>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div>
                        <strong>ID:</strong> {selectedNode.data.id}
                      </div>
                      <div>
                        <strong>Performed by:</strong>{" "}
                        {(selectedNode.data as Activity).performedBy}
                      </div>
                      <div>
                        <strong>Timestamp:</strong>{" "}
                        {new Date(
                          (selectedNode.data as Activity).timestamp
                        ).toLocaleString()}
                      </div>
                      {(selectedNode.data as Activity).inputs.length > 0 && (
                        <div>
                          <strong>Inputs:</strong>
                          <div className="mt-1">
                            {(selectedNode.data as Activity).inputs.map(
                              (input) => (
                                <Badge
                                  key={input}
                                  variant="secondary"
                                  className="text-xs mr-1 mb-1"
                                >
                                  {input}
                                </Badge>
                              )
                            )}
                          </div>
                        </div>
                      )}
                      {(selectedNode.data as Activity).outputs.length > 0 && (
                        <div>
                          <strong>Outputs:</strong>
                          <div className="mt-1">
                            {(selectedNode.data as Activity).outputs.map(
                              (output) => (
                                <Badge
                                  key={output}
                                  variant="outline"
                                  className="text-xs mr-1 mb-1"
                                >
                                  {output}
                                </Badge>
                              )
                            )}
                          </div>
                        </div>
                      )}
                      {(selectedNode.data as Activity).metadata && (
                        <div>
                          <strong>Metadata:</strong>
                          <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto">
                            {JSON.stringify(
                              (selectedNode.data as Activity).metadata,
                              null,
                              2
                            )}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Legend</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <h4 className="font-medium mb-2">Entity Types</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-blue-100 border border-blue-300 rounded"></div>
                    <span>Resource</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-purple-100 border border-purple-300 rounded"></div>
                    <span>AI Agent</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
                    <span>Human</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-orange-100 border border-orange-300 rounded"></div>
                    <span>Tool</span>
                  </div>
                </div>
              </div>
              <Separator />
              <div>
                <h4 className="font-medium mb-2">Activity Types</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-green-500 rounded"></div>
                    <span>Generate</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-blue-500 rounded"></div>
                    <span>Transform</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-orange-500 rounded"></div>
                    <span>Reference</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-purple-500 rounded"></div>
                    <span>Approve</span>
                  </div>
                </div>
              </div>
              <Separator />
              <div>
                <h4 className="font-medium mb-2">Special Indicators</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-0.5 bg-gray-500"></div>
                    <span>Input</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-0.5 bg-green-600"></div>
                    <span>Output</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-red-500 border-dashed rounded"></div>
                    <span>Focused Resource</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Total Entities:</span>
                <Badge variant="secondary">{entities.length}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Total Activities:</span>
                <Badge variant="secondary">{activities.length}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Total Attributions:</span>
                <Badge variant="secondary">{attributions.length}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Visible Nodes:</span>
                <Badge variant="secondary">{nodes.length}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Connections:</span>
                <Badge variant="secondary">{edges.length}</Badge>
              </div>
              {selectedResourceId && (
                <div className="flex justify-between">
                  <span>Focus Mode:</span>
                  <Badge
                    variant="outline"
                    className="bg-blue-100 text-blue-800"
                  >
                    Active
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
