import { client } from "@/lib/schematic";

const ensuredUsers = new Set<string>();

export async function ensureSchematicIdentity(userId: string) {
  if (!userId || ensuredUsers.has(userId)) {
    return;
  }

  try {
    await client.identify({
      company: {
        keys: {
          id: userId,
        },
      },
      keys: {
        userId,
      },
    });
    ensuredUsers.add(userId);
  } catch (error) {
    console.warn("Failed to bootstrap schematic identity", userId, error);
  }
}
