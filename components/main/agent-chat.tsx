"use client";

import type React from "react";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Send, Bot, User, Loader2, PenToolIcon as Tool } from "lucide-react";
import type { Agent, ChatMessage, ToolCall } from "@/types/agent";
import Image from "next/image";

interface AgentChatProps {
  agent: Agent;
  onClose: () => void;
}

export function AgentChat({ agent, onClose }: AgentChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initializeThread();
  }, [agent.id]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const initializeThread = async () => {
    try {
      const response = await fetch("/api/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: agent.id }),
      });

      if (response.ok) {
        const data = await response.json();
        setThreadId(data.threadId);

        // Load existing messages if any
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages);
        }
      }
    } catch (error) {
      console.error("Failed to initialize thread:", error);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !threadId || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId,
          agentId: agent.id,
          message: input,
        }),
      });

      if (response.ok) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "",
          timestamp: new Date().toISOString(),
          toolCalls: [],
        };

        setMessages((prev) => [...prev, assistantMessage]);

        while (reader) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === "content") {
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessage.id
                        ? { ...msg, content: msg.content + data.content }
                        : msg
                    )
                  );
                } else if (data.type === "tool_call") {
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessage.id
                        ? {
                            ...msg,
                            toolCalls: [
                              ...(msg.toolCalls || []),
                              data.toolCall,
                            ],
                          }
                        : msg
                    )
                  );
                } else if (data.type === "tool_result") {
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessage.id
                        ? {
                            ...msg,
                            toolCalls: msg.toolCalls?.map((tc) =>
                              tc.id === data.toolCallId
                                ? { ...tc, result: data.result }
                                : tc
                            ),
                          }
                        : msg
                    )
                  );
                }
              } catch (e) {
                console.error("Failed to parse SSE data:", e);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const isImageUrl = (url: string): boolean => {
    if (typeof url !== "string") return false;
    return (
      url.match(/\.(jpeg|jpg|gif|png|webp)$/) !== null ||
      url.includes("images.unsplash.com")
    );
  };

  const renderToolCallResult = (toolCall: ToolCall) => {
    // Handle image generation results
    if (
      toolCall.function.name === "image_generation" &&
      typeof toolCall.result === "string"
    ) {
      return (
        <div>
          <div className="mb-2">
            <strong>Generated Image:</strong>
            <p className="text-xs text-muted-foreground break-all mb-2">
              {toolCall.result}
            </p>
          </div>
          <div className="relative w-full h-64 rounded-md overflow-hidden">
            <Image
              src={toolCall.result || "/placeholder.svg"}
              alt="Generated image"
              fill
              className="object-contain"
            />
          </div>
        </div>
      );
    }

    // Handle agent call results
    if (toolCall.function.name === "call_agent" && toolCall.result) {
      return (
        <div>
          <strong>Agent Response:</strong>
          <p className="whitespace-pre-wrap">{toolCall.result}</p>
        </div>
      );
    }

    // Default rendering for other tool results
    return (
      <pre className="mt-1 p-2 bg-green-50 border border-green-200 rounded text-xs overflow-x-auto">
        {typeof toolCall.result === "string"
          ? toolCall.result
          : JSON.stringify(toolCall.result, null, 2)}
      </pre>
    );
  };

  return (
    <div className="flex flex-col h-90">
      <ScrollArea className="flex-1 p-4 h-90" ref={scrollAreaRef}>
        <div className="space-y-4">
          {messages.map((message) => (
            <div key={message.id} className="space-y-2">
              <div
                className={`flex items-start space-x-3 ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`flex items-start space-x-3 max-w-[80%] ${
                    message.role === "user"
                      ? "flex-row-reverse space-x-reverse"
                      : ""
                  }`}
                >
                  <div
                    className={`p-2 rounded-full ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {message.role === "user" ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                  </div>
                  <Card
                    className={`${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <CardContent className="p-3">
                      <p className="text-sm whitespace-pre-wrap">
                        {message.content}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {message.toolCalls && message.toolCalls.length > 0 && (
                <div className="ml-12 space-y-2">
                  {message.toolCalls.map((toolCall) => (
                    <Card
                      key={toolCall.id}
                      className="border-l-4 border-l-blue-500"
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center space-x-2 mb-2">
                          <Tool className="h-4 w-4 text-blue-500" />
                          <Badge variant="outline">
                            {toolCall.function.name}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <div>
                            <strong>Arguments:</strong>
                            <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto">
                              {JSON.stringify(
                                JSON.parse(toolCall.function.arguments),
                                null,
                                2
                              )}
                            </pre>
                          </div>
                          {toolCall.result && (
                            <div>
                              <strong>Result:</strong>
                              {renderToolCallResult(toolCall)}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-full bg-muted">
                <Bot className="h-4 w-4" />
              </div>
              <Card className="bg-muted">
                <CardContent className="p-3">
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Agent is thinking...</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </ScrollArea>

      <Separator />

      <div className="p-4">
        <div className="flex space-x-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            disabled={isLoading}
          />
          <Button onClick={sendMessage} disabled={isLoading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
