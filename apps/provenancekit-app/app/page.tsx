// app/page.tsx
"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { ResultList } from "@/components/provenance/results-list";
import { jsonFetch } from "@/lib/fetcher";

export default function DemoPage() {
  return (
    <main className="px-6 py-8 max-w-6xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold">ProvenanceKit × OpenAI Demo</h1>
      <p className="text-sm text-muted-foreground">
        Try different OpenAI modalities and inspect provenance graphs.
      </p>

      <Tabs defaultValue="chat" className="w-full">
        <TabsList>
          <TabsTrigger value="chat">Text (Chat)</TabsTrigger>
          <TabsTrigger value="imggen">Image Gen</TabsTrigger>
          <TabsTrigger value="imgedit">Image Edit</TabsTrigger>
          <TabsTrigger value="tts">Text → Speech</TabsTrigger>
          <TabsTrigger value="stt">Speech → Text</TabsTrigger>
        </TabsList>

        <TabsContent value="chat">
          <ChatTab />
        </TabsContent>
        <TabsContent value="imggen">
          <ImageGenTab />
        </TabsContent>
        <TabsContent value="imgedit">
          <ImageEditTab />
        </TabsContent>
        <TabsContent value="tts">
          <TTSTab />
        </TabsContent>
        <TabsContent value="stt">
          <STTTab />
        </TabsContent>
      </Tabs>
    </main>
  );
}

/* -------------------- Chat -------------------- */
function ChatTab() {
  const [input, setInput] = useState(
    "Hello, explain provenance in 1 paragraph."
  );
  const [output, setOutput] = useState<string | null>(null);
  const [cids, setCids] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setOutput(null);
    setCids([]);
    try {
      const res = await jsonFetch<{
        completion: any;
        finalOutputCids: string[];
      }>("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          messages: [
            { role: "system", content: "You are helpful." },
            { role: "user", content: input },
          ],
        }),
      });
      setOutput(res.completion.choices[0].message.content);
      setCids(res.finalOutputCids);
    } catch (e: any) {
      setOutput("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chat Completion with Provenance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea value={input} onChange={(e) => setInput(e.target.value)} />
        <Button onClick={run} disabled={loading}>
          {loading ? "Running…" : "Send"}
        </Button>
        {output && (
          <div className="whitespace-pre-wrap border rounded p-3 text-sm">
            {output}
          </div>
        )}
        <ResultList cids={cids} />
      </CardContent>
    </Card>
  );
}

/* -------------------- Image Gen -------------------- */
function ImageGenTab() {
  const [prompt, setPrompt] = useState("A cute robot painting a canvas");
  const [images, setImages] = useState<string[]>([]);
  const [cids, setCids] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setImages([]);
    setCids([]);
    try {
      const res = await jsonFetch<any>("/api/image/generate", {
        method: "POST",
        body: JSON.stringify({ prompt }),
      });

      const urls: string[] = res.data.map(
        (d: any) => d.url ?? `data:image/png;base64,${d.b64_json}`
      );
      setImages(urls);

      const prov: any[] = res.provenance;
      setCids(prov.map((p: any) => p.cid));
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Image Generation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        <Button onClick={run} disabled={loading}>
          {loading ? "Generating…" : "Generate"}
        </Button>
        <div className="grid grid-cols-3 gap-4">
          {images.map((src, idx) => (
            <img key={idx} src={src} alt="gen" className="rounded border" />
          ))}
        </div>
        <ResultList cids={cids} />
      </CardContent>
    </Card>
  );
}

/* -------------------- Image Edit -------------------- */
function ImageEditTab() {
  const [prompt, setPrompt] = useState("Add a red hat");
  const [image, setImage] = useState<File | null>(null);
  const [mask, setMask] = useState<File | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [cids, setCids] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function run() {
    if (!image) return alert("Choose base image");
    setLoading(true);
    setImages([]);
    setCids([]);
    try {
      const fd = new FormData();
      fd.append("prompt", prompt);
      fd.append("image", image);
      if (mask) fd.append("mask", mask);

      const res = await fetch("/api/image/edit", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      const urls: string[] = data.data.map(
        (d: any) => d.url ?? `data:image/png;base64,${d.b64_json}`
      );
      setImages(urls);
      const prov: any[] = data.provenance;
      setCids(prov.map((p: any) => p.cid));
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Image Edit</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          type="file"
          accept="image/*"
          onChange={(e) => setImage(e.target.files?.[0] ?? null)}
        />
        <Input
          type="file"
          accept="image/*"
          onChange={(e) => setMask(e.target.files?.[0] ?? null)}
        />
        <Input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Edit prompt"
        />
        <Button onClick={run} disabled={loading}>
          {loading ? "Editing…" : "Edit Image"}
        </Button>

        <div className="grid grid-cols-3 gap-4">
          {images.map((src, idx) => (
            <img key={idx} src={src} alt="edit" className="rounded border" />
          ))}
        </div>
        <ResultList cids={cids} />
      </CardContent>
    </Card>
  );
}

/* -------------------- TTS -------------------- */
function TTSTab() {
  const [text, setText] = useState("Hello world from ProvenanceKit.");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [cid, setCid] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setAudioUrl(null);
    setCid(null);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      setCid(res.headers.get("X-Provenance-CID"));
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Text → Speech</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} />
        <Button onClick={run} disabled={loading}>
          {loading ? "Synthesizing…" : "Synthesize"}
        </Button>
        {audioUrl && <audio controls src={audioUrl} className="mt-3 w-full" />}
        <ResultList cids={cid ? [cid] : []} />
      </CardContent>
    </Card>
  );
}

/* -------------------- STT -------------------- */
function STTTab() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [cid, setCid] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    if (!file) return alert("Upload audio");
    setLoading(true);
    setText(null);
    setCid(null);
    try {
      const bytes = await file.arrayBuffer();
      const base64Audio = Buffer.from(bytes).toString("base64");

      const res = await jsonFetch<any>("/api/stt", {
        method: "POST",
        body: JSON.stringify({ base64Audio, mime: file.type }),
      });

      setText(res.text);
      setCid(res.provenance.cid);
    } catch (e: any) {
      setText("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Speech → Text</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          type="file"
          accept="audio/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <Button onClick={run} disabled={loading}>
          {loading ? "Transcribing…" : "Transcribe"}
        </Button>
        {text && <div className="border rounded p-3 text-sm">{text}</div>}
        <ResultList cids={cid ? [cid] : []} />
      </CardContent>
    </Card>
  );
}
