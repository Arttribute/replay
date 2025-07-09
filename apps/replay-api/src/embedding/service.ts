import { sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { resource } from "../../db/schema.js";
import { XenovaUniversalProvider } from "./xenova-universal.provider.js";

export class EmbeddingService {
	constructor(private p = new XenovaUniversalProvider()) {}

	async vector(
		kind: "text" | "image" | "audio" | "video",
		dataUriOrUrl: string,
	) {
		switch (kind) {
			case "text":
				return this.p.encodeText(dataUriOrUrl);
			case "image":
				return this.p.encodeImage(dataUriOrUrl);
			//case "audio": return this.p.encodeAudio(dataUriOrUrl);
			case "video":
				return this.p.encodeVideo(dataUriOrUrl);
		}
	}

	async store(cid: string, vec: number[]) {
		await db.update(resource).set({ embedding: vec }).where(sql`cid = ${cid}`);
	}

	/** Cosine-similarity search */
	async match(vec: number[], { high = 0.85, low = 0.75, topK = 5 } = {}) {
		const rows = await db.execute<{ cid: string; score: number }>(
			sql`select cid,
                 1 - (embedding <=> ${vec}) as score
          from resource
          where embedding is not null
          order by score desc
          limit ${topK}`,
		);

		if (!rows.length) return { verdict: "no-match", matches: [] };

		const best = rows[0];
		if (best.score >= high) return { verdict: "auto", matches: rows };
		if (best.score >= low) return { verdict: "review", matches: rows };
		return { verdict: "no-match", matches: rows };
	}
}
