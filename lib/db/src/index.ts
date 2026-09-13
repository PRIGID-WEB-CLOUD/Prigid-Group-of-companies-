import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

let pool: any;
let db: any;

if (process.env.DATABASE_URL) {
  try {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzle(pool, { schema });
  } catch (err) {
    console.warn("[AI Studio] Database connection failed:", err);
  }
}

if (!db) {
  console.warn("[AI Studio] DATABASE_URL is not set or connection failed — using mock db fallback");
  
  const createMockChain = (): any => {
    const fn = () => {};
    
    const proxy = new Proxy(fn, {
      get: (target, prop) => {
        if (prop === "then") {
          return (resolve: any) => resolve([]);
        }
        return createMockChain();
      },
      apply: (target, thisArg, argList) => {
        const firstArg = argList[0];
        if (typeof firstArg === "function") {
          try {
            const res = firstArg(proxy);
            if (res instanceof Promise) {
              return res.then(() => proxy);
            }
          } catch {}
        }
        return proxy;
      }
    });
    
    return proxy;
  };

  db = createMockChain();
}

export { pool, db };
export * from "./schema";
