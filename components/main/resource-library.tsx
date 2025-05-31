"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Search,
  Download,
  Eye,
  FileText,
  ImageIcon,
  Music,
  Video,
  RefreshCw,
} from "lucide-react";
import type { Entity, Attribution } from "@/types/provenance";

export function ResourceLibrary() {
  const [resources, setResources] = useState<Entity[]>([]);
  const [attributions, setAttributions] = useState<Attribution[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadResources();
  }, []);

  const loadResources = async () => {
    try {
      setIsLoading(true);
      const [resourcesRes, attributionsRes] = await Promise.all([
        fetch("/api/provenance/entities?type=resource"),
        fetch("/api/provenance/attributions"),
      ]);

      if (resourcesRes.ok && attributionsRes.ok) {
        const [resourcesData, attributionsData] = await Promise.all([
          resourcesRes.json(),
          attributionsRes.json(),
        ]);

        setResources(resourcesData);
        setAttributions(attributionsData);
      }
    } catch (error) {
      console.error("Failed to load resources:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredResources = resources.filter((resource) => {
    const matchesSearch =
      resource.metadata.title
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      resource.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType =
      selectedType === "all" || resource.metadata.format === selectedType;
    return matchesSearch && matchesType;
  });

  const getResourceIcon = (format: string) => {
    switch (format?.toLowerCase()) {
      case "png":
      case "jpg":
      case "jpeg":
      case "gif":
      case "svg":
        return <ImageIcon className="h-5 w-5" />;
      case "mp3":
      case "wav":
      case "ogg":
        return <Music className="h-5 w-5" />;
      case "mp4":
      case "avi":
      case "mov":
        return <Video className="h-5 w-5" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  const getResourceAttributions = (resourceId: string) => {
    return attributions.filter((attr) => attr.resourceId === resourceId);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (
      Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
    );
  };

  const resourceTypes = [
    "all",
    "png",
    "jpg",
    "mp3",
    "mp4",
    "pdf",
    "txt",
    "csv",
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Resource Library</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={loadResources}
          disabled={isLoading}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search resources..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          {resourceTypes.map((type) => (
            <Button
              key={type}
              variant={selectedType === type ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedType(type)}
            >
              {type === "all" ? "All" : type.toUpperCase()}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredResources.map((resource) => {
          const resourceAttributions = getResourceAttributions(resource.id);

          return (
            <Card key={resource.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {getResourceIcon(resource.metadata.format)}
                    <CardTitle className="text-base truncate">
                      {resource.metadata.title || resource.id}
                    </CardTitle>
                  </div>
                  <Badge variant="secondary">
                    {resource.metadata.format || "unknown"}
                  </Badge>
                </div>
                <CardDescription className="text-sm">
                  {resource.metadata.description || "No description available"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Size:</span>
                    <p className="text-muted-foreground">
                      {resource.metadata.size
                        ? formatFileSize(resource.metadata.size)
                        : "Unknown"}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium">Created:</span>
                    <p className="text-muted-foreground">
                      {resource.metadata.createdAt
                        ? new Date(
                            resource.metadata.createdAt
                          ).toLocaleDateString()
                        : "Unknown"}
                    </p>
                  </div>
                </div>

                <Separator />

                <div>
                  <span className="font-medium text-sm">Contributors:</span>
                  <div className="mt-2 space-y-1">
                    {resourceAttributions.map((attribution) => (
                      <div
                        key={`${attribution.resourceId}-${attribution.contributorId}`}
                        className="flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline" className="text-xs">
                            {attribution.role}
                          </Badge>
                          <span className="text-muted-foreground">
                            {attribution.contributorId}
                          </span>
                        </div>
                        {attribution.weight && (
                          <span className="text-muted-foreground">
                            {Math.round(attribution.weight * 100)}%
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="flex space-x-2">
                  <Button size="sm" variant="outline" className="flex-1">
                    <Eye className="h-4 w-4 mr-2" />
                    View
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredResources.length === 0 && !isLoading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Resources Found</h3>
            <p className="text-muted-foreground text-center">
              {searchTerm || selectedType !== "all"
                ? "Try adjusting your search criteria"
                : "Start creating content with agents to see resources here"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
