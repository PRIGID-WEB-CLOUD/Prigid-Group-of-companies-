import { db, channelConfigsTable, channelCredentialsTable } from "./index";
import { eq } from "drizzle-orm";

async function list() {
  console.log("--- Connected Meta Accounts ---");
  
  const connected = await db.select().from(channelConfigsTable).where(eq(channelConfigsTable.status, "CONNECTED"));
  
  if (connected.length === 0) {
    console.log("No accounts are currently marked as CONNECTED.");
    return;
  }

  for (const config of connected) {
    const [credRow] = await db.select().from(channelCredentialsTable).where(eq(channelCredentialsTable.channel, config.channelId)).limit(1);
    const data = credRow?.data || {};
    
    // Only show non-sensitive info
    const info: Record<string, string> = {};
    for (const [k, v] of Object.entries(data)) {
        if (!k.includes("secret") && !k.includes("token") && !k.includes("key")) {
            info[k] = v as string;
        }
    }

    console.log(`\nChannel: ${config.channelId}`);
    console.log(`Status: ${config.status}`);
    console.log(`Last Sync: ${config.lastSync}`);
    console.log(`Metadata:`, JSON.stringify(info, null, 2));
  }
}

list().catch(console.error);
