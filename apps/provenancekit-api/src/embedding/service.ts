import { XenovaUniversalProvider } from "./xenova-universal.provider.js";
import { db } from "../../db/client.js";
import { resource } from "../../db/schema.js";
import { sql } from "drizzle-orm";
import { vecLiteral } from "../utils.js";

export class EmbeddingService {
  constructor(private p = new XenovaUniversalProvider()) {}

  async vector(
    kind: "text" | "image" | "audio" | "video" | "tool",
    dataUriOrUrl: string
  ) {
    switch (kind) {
      case "text":
      case "tool": // 👈 tools are just JSON/text, embed as text
        return this.p.encodeText(dataUriOrUrl);
      case "image":
        return this.p.encodeImage(dataUriOrUrl);
      case "audio":
        return this.p.encodeAudio(dataUriOrUrl);
      case "video":
        return this.p.encodeVideo(dataUriOrUrl);
    }
  }

  async store(cid: string, vec: number[]) {
    await db
      .update(resource)
      .set({ embedding: vec })
      .where(sql`cid = ${cid}`);
    console.log("Stored embedding for CID:", cid);
  }

  /** Cosine-similarity search */
  async match(vec: number[], { high = 0.85, low = 0.75, topK = 5 } = {}) {
    const rows = await db.execute<{ cid: string; score: number }>(
      sql`select cid,
                 1 - (embedding <=> ${vec}) as score
          from resource
          where embedding is not null
          order by score desc
          limit ${topK}`
    );

    if (!rows.length) return { verdict: "no-match", matches: [] };

    const best = rows[0];
    if (best.score >= high) return { verdict: "auto", matches: rows };
    if (best.score >= low) return { verdict: "review", matches: rows };
    return { verdict: "no-match", matches: rows };
  }

  async matchFiltered(
    vec: number[],
    opts: { topK?: number; minScore?: number; type?: string } = {}
  ) {
    const { topK = 5, minScore = 0, type } = opts;
    //handele empty vector
    if (!vec || !vec.length) {
      return [];
    }
    /* (1) stringify -> '[0.12,-0.34,…]' */
    const lit = vecLiteral(vec);

    /* (2) use it as a *parameter* and cast inside SQL  ------------ */
    const rows = await db.execute<{
      cid: string;
      type: string;
      score: number;
    }>(sql`
    SELECT cid,
           type,
           1 - (embedding <=> ${lit}::vector) AS score   -- 👈 cast here
    FROM   resource
    WHERE  embedding IS NOT NULL
           ${type ? sql`AND type = ${type}` : sql``}
    ORDER  BY score DESC
    LIMIT  ${topK}
  `);

    return rows.filter((r) => r.score >= minScore);
  }

  async matchTop1(vec: number[], minScore = 0.95, type?: string) {
    const res = await this.matchFiltered(vec, { topK: 1, minScore, type });
    return res[0];
  }
}
