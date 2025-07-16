import { db } from "../../db/client.js";
import { entity } from "../../db/schema.js";
import { v4 as uuidv4 } from "uuid";

export async function upsertEntity(props: {
  role: string;
  name?: string;
  wallet?: string;
  publicKey?: string;
}) {
  const id = uuidv4();
  await db
    .insert(entity)
    .values({
      entityId: id,
      role: props.role,
      name: props.name ?? null,
      wallet: props.wallet ?? null,
      publicKey: props.publicKey ?? null,
    })
    .onConflictDoNothing();
  return id;
}
