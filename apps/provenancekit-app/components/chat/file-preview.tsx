// components/chat/file-preview.tsx
"use client";

import { Button } from "@/components/ui/button";
import {
  X,
  FileText,
  Video,
  Music,
  File,
  ImageIcon,
  CheckCircle,
} from "lucide-react";

export function FilePreview({
  file,
  onRemove,
  onExpand,
  matched,
  pending,
}: {
  file: File;
  onRemove: () => void;
  onExpand: () => void;
  matched?: boolean;
  pending?: boolean;
}) {
  const getIcon = (type: string) => {
    if (type.startsWith("image/")) return ImageIcon;
    if (type.startsWith("video/")) return Video;
    if (type.startsWith("audio/")) return Music;
    if (
      type.includes("pdf") ||
      type.includes("document") ||
      type.includes("text")
    )
      return FileText;
    return File;
  };
  const getColor = (type: string) => {
    if (type.includes("pdf")) return "bg-red-500";
    if (type.startsWith("image/")) return "bg-blue-500";
    if (type.startsWith("video/")) return "bg-purple-500";
    if (type.startsWith("audio/")) return "bg-green-500";
    return "bg-gray-500";
  };
  const Icon = getIcon(file.type);
  const colorClass = getColor(file.type);

  return (
    <div className="relative group flex-shrink-0">
      {file.type.startsWith("image/") ? (
        <div className="relative">
          <div
            className="w-16 h-16 bg-gray-200 rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
            onClick={onExpand}
          >
            <img
              src={URL.createObjectURL(file) || "/placeholder.svg"}
              alt={file.name}
              className="w-full h-full object-cover"
              onLoad={(e) =>
                URL.revokeObjectURL((e.target as HTMLImageElement).src)
              }
            />
          </div>

          {pending && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-lg">
              <div className="w-4 h-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {matched && !pending && (
            <CheckCircle className="absolute -bottom-2 -right-2 w-5 h-5 text-green-500 bg-white rounded-full" />
          )}

          <Button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            variant="destructive"
            size="sm"
            className="absolute -top-2 -right-2 h-5 w-5 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      ) : (
        <div
          className="flex items-center gap-3 bg-gray-800 text-white rounded-full px-4 py-3 cursor-pointer hover:bg-gray-700 transition-colors min-w-[200px] max-w-[300px] relative"
          onClick={onExpand}
        >
          <div
            className={`w-6 h-6 rounded-sm ${colorClass} flex items-center justify-center flex-shrink-0`}
          >
            <Icon className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium truncate block">
              {file.name}
            </span>
            <span className="text-xs text-gray-300 truncate block">
              {file.type ? file.type.split("/")[0].toUpperCase() : "FILE"}
            </span>
          </div>
          {matched && !pending && (
            <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
          )}
          {pending && (
            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 rounded-full hover:bg-gray-600 flex-shrink-0 z-10"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
