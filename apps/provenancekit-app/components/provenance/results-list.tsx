// components/provenance/ResultList.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GraphFlow } from "./graph-flow";
import { jsonFetch } from "@/lib/fetcher";
import { ProvenanceGraphDialog } from "@/components/provenance/provenance-graph-dialog";

interface GraphData {
  nodes: any[];
  edges: any[];
}

export function ResultList({ cids }: { cids: string[] }) {
  const [open, setOpen] = useState(false);
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);

  async function openGraph(cid: string) {
    setLoading(true);
    try {
      const data = await jsonFetch<GraphData>(
        `/api/provenance/graph?cid=${cid}`
      );
      setGraph(data);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }

  if (!cids.length) return null;

  return (
    <div className="space-y-2">
      <h3 className="font-medium">Outputs</h3>
      <ul className="space-y-1">
        {cids.map((cid) => (
          <li key={cid} className="flex gap-2 items-center text-sm">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-gray-400 truncate">
                {cid}
              </span>
              <ProvenanceGraphDialog cid={cid} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
