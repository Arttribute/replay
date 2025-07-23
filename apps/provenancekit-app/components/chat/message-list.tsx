// components/chat/message-list.tsx
"use client";

import { ProvenanceGraphDialog } from "@/components/provenance/provenance-graph-dialog";

export function MessageList({
  messages,
}: {
  messages: {
    id: string;
    role: "user" | "assistant";
    content: string;
    attachments?: { name: string; cid: string; matched?: any }[];
    outputCids?: string[];
  }[];
}) {
  return (
    <div className="space-y-6">
      {messages.map((m) => (
        <div key={m.id} className="flex gap-3">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${
              m.role === "user" ? "bg-blue-500" : "bg-green-500"
            }`}
          >
            {m.role === "user" ? "U" : "A"}
          </div>
          <div className="flex-1 space-y-2">
            <div className="whitespace-pre-wrap text-sm text-gray-900">
              {m.content}
            </div>

            {m.attachments?.length ? (
              <div className="flex flex-wrap gap-2">
                {m.attachments.map((a) => (
                  <span
                    key={a.cid}
                    className="inline-flex items-center gap-1 text-xs bg-gray-200 rounded px-2 py-1 font-mono"
                  >
                    {a.name}{" "}
                    {a.matched ? (
                      <span className="text-green-600">(matched)</span>
                    ) : (
                      <span className="text-gray-500">(new)</span>
                    )}
                  </span>
                ))}
              </div>
            ) : null}

            {m.outputCids?.length ? (
              <div className="flex flex-wrap gap-2">
                {m.outputCids.map((cid) => (
                  <ProvenanceGraphDialog key={cid} cid={cid} />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
