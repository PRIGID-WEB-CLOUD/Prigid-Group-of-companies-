import { db, channelEventLogsTable } from "./index";
import { desc, eq } from "drizzle-orm";

async function listErrors() {
  console.log("--- Recent Error Events ---");
  const errors = await db.select()
    .from(channelEventLogsTable)
    .where(eq(channelEventLogsTable.type, "error"))
    .orderBy(desc(channelEventLogsTable.createdAt))
    .limit(10);
  
  if (errors.length === 0) {
    console.log("No error events found.");
    return;
  }

  for (const err of errors) {
    console.log(`\nTime: ${err.createdAt}`);
    console.log(`Channel: ${err.channel}`);
    console.log(`Event: ${err.event}`);
    console.log(`Detail: ${err.detail}`);
  }
}

listErrors().catch(console.error);
