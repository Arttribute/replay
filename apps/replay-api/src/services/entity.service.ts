import { db } from "../../db/client";
import { entity } from "../../db/schema";
import { v4 as uuidv4 } from "uuid";

export async function upsertEntity(body: {
  role: string;
  name?: string;
  wallet?: string;
  publicKey?: string;
  metadata?: Record<string, any>;
  extensions?: Record<string, any>;
}) {
  const id = uuidv4();
  await db.insert(entity).values({
    entityId: id,
    role: body.role,
    name: body.name ?? null,
    wallet: body.wallet ?? null,
    publicKey: body.publicKey ?? null,
    metadata: body.metadata ?? null,
    extensions: body.extensions ?? null,
  });

  return id;
}
