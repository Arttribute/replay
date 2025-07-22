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
      const data = await jsonFetch<GraphData>(`/api/graph/${cid}`);
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
            <code className="break-all">{cid}</code>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => openGraph(cid)}
            >
              Graph
            </Button>
          </li>
        ))}
      </ul>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>Provenance Graph</DialogTitle>
          </DialogHeader>
          {loading && <div className="p-4 text-sm">Loading…</div>}
          {graph && <GraphFlow nodes={graph.nodes} edges={graph.edges} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
