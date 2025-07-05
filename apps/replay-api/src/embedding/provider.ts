export interface EmbeddingProvider {
  encodeText(t: string): Promise<number[]>;
  encodeImage(i: string | Uint8Array): Promise<number[]>;
  //encodeAudio(a: string | Uint8Array): Promise<number[]>;
  encodeVideo(v: string | Uint8Array): Promise<number[]>;
}
