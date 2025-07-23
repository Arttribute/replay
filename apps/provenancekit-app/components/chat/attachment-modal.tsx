// components/chat/attachment-modal.tsx
"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  X,
  Download,
  FileText,
  Video,
  Music,
  File,
  ImageIcon,
} from "lucide-react";
import { InspectedAttachment } from "@/lib/attachments";
import { ProvenanceGraphDialog } from "@/components/provenance/provenance-graph-dialog";

interface AttachmentModalProps {
  attachment: InspectedAttachment;
  onClose: () => void;
  onRemove: () => void;
}

export function AttachmentModal({
  attachment,
  onClose,
  onRemove,
}: AttachmentModalProps) {
  const { file, status, cid, score } = attachment;
  const [content, setContent] = useState<string>("");

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  useEffect(() => {
    if (file.type.startsWith("text/")) {
      const reader = new FileReader();
      reader.onload = (e) => setContent(e.target?.result as string);
      reader.readAsText(file);
    }
  }, [file]);

  const iconMap = (t: string) => {
    if (t.startsWith("image/")) return ImageIcon;
    if (t.startsWith("video/")) return Video;
    if (t.startsWith("audio/")) return Music;
    if (t.includes("pdf") || t.includes("document") || t.includes("text"))
      return FileText;
    return File;
  };
  const Icon = iconMap(file.type);

  const sizeFmt = (bytes: number) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${
      ["B", "KB", "MB", "GB"][i]
    }`;
    // simplified
  };

  const download = () => {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const preview = () => {
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      return (
        <img
          src={url}
          alt={file.name}
          className="max-w-full max-h-96 object-contain rounded-lg"
          onLoad={() => URL.revokeObjectURL(url)}
        />
      );
    }
    if (file.type.startsWith("video/")) {
      const url = URL.createObjectURL(file);
      return (
        <video
          src={url}
          className="max-w-full max-h-96 rounded-lg"
          controls
          onLoadedData={() => URL.revokeObjectURL(url)}
        />
      );
    }
    if (file.type === "application/pdf") {
      const url = URL.createObjectURL(file);
      return (
        <div className="w-full h-96">
          <iframe
            src={url}
            className="w-full h-full rounded-lg border"
            title={file.name}
            onLoad={() => URL.revokeObjectURL(url)}
          />
        </div>
      );
    }
    if (file.type.startsWith("text/")) {
      return (
        <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-auto">
          <pre className="whitespace-pre-wrap text-sm text-gray-800">
            {content}
          </pre>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-gray-50 rounded-lg">
        <Icon className="w-16 h-16 text-gray-400 mb-4" />
        <p className="text-gray-600 text-center">Preview not available</p>
        <p className="text-sm text-gray-500 mt-2">Click download to view</p>
      </div>
    );
  };

  const inspecting = status === "pending";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center">
              <Icon className="w-4 h-4 text-gray-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900 truncate max-w-[300px]">
                {file.name}
              </h3>
              <p className="text-sm text-gray-500">
                {sizeFmt(file.size)} • {file.type}
              </p>
              {inspecting && (
                <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                  <span className="inline-block w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  Inspecting resource…
                </p>
              )}
              {!inspecting && status === "match" && cid && (
                <p className="text-xs text-green-600">
                  Matched resource: {cid.slice(0, 12)}… (score{" "}
                  {score?.toFixed(2)})
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!inspecting && status === "match" && cid && (
              <ProvenanceGraphDialog
                cid={cid}
                title={`Provenance: ${cid.slice(0, 12)}…`}
                trigger={
                  <Button variant="outline" size="sm">
                    Provenance
                  </Button>
                }
              />
            )}
            <Button onClick={download} variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
            <Button onClick={onRemove} variant="destructive" size="sm">
              Remove
            </Button>
            <Button onClick={onClose} variant="ghost" size="sm" className="p-2">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-auto max-h-[calc(90vh-120px)] relative">
          {preview()}
          {inspecting && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
              <div className="text-gray-700 flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-4 border-gray-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Inspecting…</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
