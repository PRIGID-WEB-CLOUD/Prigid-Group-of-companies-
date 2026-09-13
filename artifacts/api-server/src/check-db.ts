
import { db, productsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function main() {
  const active = await db.select().from(productsTable).where(eq(productsTable.status, "ACTIVE"));
  console.log("Active products count:", active.length);
  if (active.length > 0) {
    console.log("Sample product URL:", active[0].imageUrl);
  }
}

main().catch(console.error);
