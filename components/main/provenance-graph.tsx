"use client";

import { useState, useEffect, useRef } from "react";
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
import { RefreshCw, Download, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import type { Entity, Activity, Attribution } from "@/types/provenance";

export function ProvenanceGraph() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [attributions, setAttributions] = useState<Attribution[]>([]);
  const [selectedNode, setSelectedNode] = useState<Entity | Activity | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  useEffect(() => {
    loadProvenanceData();
  }, []);

  useEffect(() => {
    if (entities.length > 0 || activities.length > 0) {
      drawGraph();
    }
  }, [entities, activities, attributions, zoom, pan]);

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

  const drawGraph = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply zoom and pan
    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(pan.x, pan.y);

    // Draw entities
    entities.forEach((entity, index) => {
      const x = 100 + (index % 5) * 150;
      const y = 100 + Math.floor(index / 5) * 100;

      // Draw entity node
      ctx.fillStyle = getEntityColor(entity.type);
      ctx.fillRect(x - 40, y - 20, 80, 40);

      // Draw entity label
      ctx.fillStyle = "#000";
      ctx.font = "12px Arial";
      ctx.textAlign = "center";
      ctx.fillText(entity.metadata.name || entity.id, x, y + 5);

      // Draw entity type
      ctx.font = "10px Arial";
      ctx.fillStyle = "#666";
      ctx.fillText(entity.type, x, y + 18);
    });

    // Draw activities
    activities.forEach((activity, index) => {
      const x = 200 + (index % 4) * 180;
      const y = 250 + Math.floor(index / 4) * 120;

      // Draw activity node (diamond shape)
      ctx.fillStyle = getActivityColor(activity.type);
      ctx.beginPath();
      ctx.moveTo(x, y - 25);
      ctx.lineTo(x + 35, y);
      ctx.lineTo(x, y + 25);
      ctx.lineTo(x - 35, y);
      ctx.closePath();
      ctx.fill();

      // Draw activity label
      ctx.fillStyle = "#000";
      ctx.font = "10px Arial";
      ctx.textAlign = "center";
      ctx.fillText(activity.type, x, y + 5);
    });

    // Draw connections
    activities.forEach((activity) => {
      // Draw input connections
      activity.inputs.forEach((inputId) => {
        const inputEntity = entities.find((e) => e.id === inputId);
        if (inputEntity) {
          drawConnection(
            ctx,
            getEntityPosition(inputEntity, entities),
            getActivityPosition(activity, activities),
            "#999"
          );
        }
      });

      // Draw output connections
      activity.outputs.forEach((outputId) => {
        const outputEntity = entities.find((e) => e.id === outputId);
        if (outputEntity) {
          drawConnection(
            ctx,
            getActivityPosition(activity, activities),
            getEntityPosition(outputEntity, entities),
            "#333"
          );
        }
      });
    });

    ctx.restore();
  };

  const getEntityColor = (type: string) => {
    switch (type) {
      case "resource":
        return "#e3f2fd";
      case "ai":
        return "#f3e5f5";
      case "human":
        return "#e8f5e8";
      case "tool":
        return "#fff3e0";
      default:
        return "#f5f5f5";
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case "generate":
        return "#4caf50";
      case "transform":
        return "#2196f3";
      case "reference":
        return "#ff9800";
      case "approve":
        return "#9c27b0";
      case "assign":
        return "#607d8b";
      default:
        return "#9e9e9e";
    }
  };

  const getEntityPosition = (entity: Entity, entities: Entity[]) => {
    const index = entities.indexOf(entity);
    return {
      x: 100 + (index % 5) * 150,
      y: 100 + Math.floor(index / 5) * 100,
    };
  };

  const getActivityPosition = (activity: Activity, activities: Activity[]) => {
    const index = activities.indexOf(activity);
    return {
      x: 200 + (index % 4) * 180,
      y: 250 + Math.floor(index / 4) * 120,
    };
  };

  const drawConnection = (
    ctx: CanvasRenderingContext2D,
    from: { x: number; y: number },
    to: { x: number; y: number },
    color: string
  ) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();

    // Draw arrow
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const arrowLength = 10;
    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(
      to.x - arrowLength * Math.cos(angle - Math.PI / 6),
      to.y - arrowLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(
      to.x - arrowLength * Math.cos(angle + Math.PI / 6),
      to.y - arrowLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.stroke();
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(prev * 1.2, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev / 1.2, 0.3));
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const exportGraph = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement("a");
    link.download = "provenance-graph.png";
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div className="space-y-6">
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
              <CardTitle>Provenance Graph</CardTitle>
              <CardDescription>
                Interactive visualization of resource creation and
                transformation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={800}
                  height={600}
                  className="w-full h-[600px] cursor-move"
                  onMouseDown={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const startX = e.clientX - rect.left;
                    const startY = e.clientY - rect.top;

                    const handleMouseMove = (e: MouseEvent) => {
                      const deltaX = (e.clientX - rect.left - startX) / zoom;
                      const deltaY = (e.clientY - rect.top - startY) / zoom;
                      setPan((prev) => ({
                        x: prev.x + deltaX,
                        y: prev.y + deltaY,
                      }));
                    };

                    const handleMouseUp = () => {
                      document.removeEventListener(
                        "mousemove",
                        handleMouseMove
                      );
                      document.removeEventListener("mouseup", handleMouseUp);
                    };

                    document.addEventListener("mousemove", handleMouseMove);
                    document.addEventListener("mouseup", handleMouseUp);
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Legend</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <h4 className="font-medium mb-2">Entity Types</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-blue-100 border"></div>
                    <span>Resource</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-purple-100 border"></div>
                    <span>AI Agent</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-green-100 border"></div>
                    <span>Human</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-orange-100 border"></div>
                    <span>Tool</span>
                  </div>
                </div>
              </div>
              <Separator />
              <div>
                <h4 className="font-medium mb-2">Activity Types</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-green-500"></div>
                    <span>Generate</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-blue-500"></div>
                    <span>Transform</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-orange-500"></div>
                    <span>Reference</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-purple-500"></div>
                    <span>Approve</span>
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
                <span>Entities:</span>
                <Badge variant="secondary">{entities.length}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Activities:</span>
                <Badge variant="secondary">{activities.length}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Attributions:</span>
                <Badge variant="secondary">{attributions.length}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
