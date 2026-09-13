
import pg from "pg";
const { Pool } = pg;

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url });
  try {
    console.log("Checking if meta_sync_enabled column exists...");
    const checkRes = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'products' AND column_name = 'meta_sync_enabled'
    `);

    if (checkRes.rowCount === 0) {
      console.log("Adding meta_sync_enabled column to products table...");
      await pool.query(`ALTER TABLE products ADD COLUMN meta_sync_enabled BOOLEAN NOT NULL DEFAULT TRUE`);
      console.log("Column added successfully.");
    } else {
      console.log("Column already exists.");
    }
  } catch (err) {
    console.error("Error updating schema:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
