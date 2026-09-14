import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index";
import fs from "fs";
import path from "path";

const { Pool } = pg;

let pool: any;
let db: any;

const dbFilePath = process.env.DB_FALLBACK_FILE || path.resolve(process.cwd(), "artifacts/db-fallback/db.json");
let seedingPromise: Promise<void> | null = null;
let isSeeding = false;

function loadDb() {
  try {
    fs.mkdirSync(path.dirname(dbFilePath), { recursive: true });
    if (!fs.existsSync(dbFilePath)) {
      fs.writeFileSync(dbFilePath, JSON.stringify({}, null, 2), "utf8");
    }
    const content = fs.readFileSync(dbFilePath, "utf8");
    return JSON.parse(content);
  } catch (err) {
    console.error("[Fallback DB] Error loading file db:", err);
    return {};
  }
}

function saveDb(data: any) {
  try {
    fs.mkdirSync(path.dirname(dbFilePath), { recursive: true });
    fs.writeFileSync(dbFilePath, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error("[Fallback DB] Error saving file db:", err);
  }
}

function getTableName(table: any): string {
  if (!table) return "unknown";
  const drizzleNameSymbol = Symbol.for("drizzle:Name");
  if (table[drizzleNameSymbol]) return table[drizzleNameSymbol];
  if (table._ && table._.name) return table._.name;
  if (table.dbName) return table.dbName;
  if (table.name) return table.name;
  return "unknown";
}

function evaluateCondition(row: any, cond: any): boolean {
  if (!cond) return true;
  
  // Handle logical operators 'and' / 'or'
  if (cond.operator === 'and' || cond.operator === 'or') {
    const list = cond.conditions || cond.left || [];
    if (cond.operator === 'and') {
      return Array.isArray(list) ? list.every((c: any) => evaluateCondition(row, c)) : true;
    } else {
      return Array.isArray(list) ? list.some((c: any) => evaluateCondition(row, c)) : false;
    }
  }

  // Handle Drizzle SQL Chunk structures (e.g., and(...), or(...), eq(...), ne(...))
  if (cond.queryChunks) {
    const chunks = cond.queryChunks;

    // Unpack parenthesized groups e.g. ( (cond1 AND cond2) )
    if (chunks.some((c: any) => c?.value?.[0] === "(") && chunks.some((c: any) => c?.value?.[0] === ")")) {
      const innerWithChunks = chunks.filter((c: any) => c && c.queryChunks);
      if (innerWithChunks.length === 1) {
        return evaluateCondition(row, innerWithChunks[0]);
      }
    }

    const isAnd = chunks.some((k: any) => Array.isArray(k?.value) && k.value.some((v: any) => typeof v === "string" && v.includes(" and ")));
    const isOr = chunks.some((k: any) => Array.isArray(k?.value) && k.value.some((v: any) => typeof v === "string" && v.includes(" or ")));

    if (isAnd) {
      const subConditions = chunks.filter((k: any) => k && k.queryChunks);
      return subConditions.every((sub: any) => evaluateCondition(row, sub));
    }
    if (isOr) {
      const subConditions = chunks.filter((k: any) => k && k.queryChunks);
      return subConditions.some((sub: any) => evaluateCondition(row, sub));
    }

    let colName = "";
    let op = "=";
    let rightVal: any = undefined;

    for (const chunk of chunks) {
      if (!chunk) continue;
      if (chunk.name || chunk.key) {
        colName = chunk.name || chunk.key;
      } else if (chunk.value !== undefined && !Array.isArray(chunk.value)) {
        rightVal = chunk.value;
      } else if (chunk.constructor?.name === "Param") {
        rightVal = chunk.value;
      } else if (Array.isArray(chunk.value)) {
        const str = chunk.value.join("");
        if (str.includes(" = ")) op = "=";
        else if (str.includes(" <> ") || str.includes(" != ")) op = "<>";
        else if (str.includes(" >= ")) op = ">=";
        else if (str.includes(" <= ")) op = "<=";
        else if (str.includes(" > ")) op = ">";
        else if (str.includes(" < ")) op = "<";
        else if (str.includes(" is not null ")) op = "is_not_null";
        else if (str.includes(" is null ")) op = "is_null";
      }
    }

    if (colName) {
      const toCamel = (s: string) => s.replace(/_([a-z])/g, (_, g) => g.toUpperCase());
      const toSnake = (s: string) => s.replace(/[A-Z]/g, (l: string) => `_${l.toLowerCase()}`);
      const val = row[colName] !== undefined 
        ? row[colName] 
        : (row[toCamel(colName)] !== undefined ? row[toCamel(colName)] : row[toSnake(colName)]);

      if (op === "=") return val === rightVal;
      if (op === "<>") return val !== rightVal;
      if (op === ">") return val > rightVal;
      if (op === ">=") return val >= rightVal;
      if (op === "<") return val < rightVal;
      if (op === "<=") return val <= rightVal;
      if (op === "is_not_null") return val !== null && val !== undefined;
      if (op === "is_null") return val === null || val === undefined;
      return val == rightVal;
    }
  }
  
  let colName = "";
  if (cond.left) {
    colName = cond.left.name || cond.left.key || cond.left.fieldName || (typeof cond.left === "string" ? cond.left : "");
  } else if (cond.column) {
    colName = cond.column.name || cond.column.key || cond.column.fieldName || "";
  }
  
  if (colName) {
    const toCamel = (s: string) => s.replace(/_([a-z])/g, (_, g) => g.toUpperCase());
    const toSnake = (s: string) => s.replace(/[A-Z]/g, (l: string) => `_${l.toLowerCase()}`);
    const val = row[colName] !== undefined 
      ? row[colName] 
      : (row[toCamel(colName)] !== undefined ? row[toCamel(colName)] : row[toSnake(colName)]);

    let rightVal = cond.right;
    if (rightVal && typeof rightVal === 'object') {
      if (rightVal.value !== undefined) rightVal = rightVal.value;
      else if (rightVal.val !== undefined) rightVal = rightVal.val;
      else if (rightVal.queryChunks) {
        for (const chunk of rightVal.queryChunks) {
          if (chunk && chunk.value !== undefined) {
            rightVal = chunk.value;
            break;
          }
        }
      }
    } else if (cond.value !== undefined) {
      rightVal = cond.value;
    } else if (cond.val !== undefined) {
      rightVal = cond.val;
    }
    
    const op = cond.operator || "=";
    
    switch (op) {
      case '=':
        return val === rightVal;
      case '!=':
      case '<>':
        return val !== rightVal;
      case '>':
        return val > rightVal;
      case '>=':
        return val >= rightVal;
      case '<':
        return val < rightVal;
      case '<=':
        return val <= rightVal;
      case 'in':
        if (Array.isArray(rightVal)) {
          return rightVal.includes(val);
        }
        return false;
      case 'like':
      case 'ilike':
        if (typeof val === 'string' && typeof rightVal === 'string') {
          const regexStr = rightVal.replace(/%/g, '.*');
          const regex = new RegExp(`^${regexStr}$`, op === 'ilike' ? 'i' : '');
          return regex.test(val);
        }
        return false;
      default:
        return val == rightVal;
    }
  }
  
  return true;
}

async function executeQuery(chain: QueryChain) {
  if (seedingPromise && !isSeeding) {
    await seedingPromise;
  }

  const dbData = loadDb();
  const tableName = getTableName(chain.table);
  
  if (!dbData[tableName]) {
    dbData[tableName] = [];
  }
  
  const rows = dbData[tableName];

  if (chain.operation === 'select') {
    let result = [...rows];
    
    if (chain.whereCond) {
      result = result.filter(row => evaluateCondition(row, chain.whereCond));
    }

    for (const join of chain.joins) {
      const joinTableName = getTableName(join.table);
      const joinRows = dbData[joinTableName] || [];
      
      if (tableName === 'products' && joinTableName === 'categories') {
        result = result.map(p => {
          const category = joinRows.find((c: any) => c.id === p.categoryId);
          return {
            ...p,
            categoryName: category ? category.name : null
          };
        });
      } else {
        const cond = join.condition;
        if (cond && cond.operator === '=') {
          const leftCol = cond.left?.name;
          const rightCol = cond.right?.name;
          if (leftCol && rightCol) {
            result = result.map(row => {
              const matchedJoin = joinRows.find((jr: any) => jr[rightCol] === row[leftCol] || jr.id === row[leftCol]);
              return { ...row, ...matchedJoin };
            });
          }
        }
      }
    }

    if (chain.selectFields) {
      result = result.map(row => {
        const mapped: any = {};
        for (const [key, fieldExpr] of Object.entries(chain.selectFields)) {
          const fieldName = (fieldExpr as any).name || key;
          mapped[key] = row[fieldName] !== undefined ? row[fieldName] : row[key];
        }
        return mapped;
      });
    }

    if (chain.offsetVal !== null) {
      result = result.slice(chain.offsetVal);
    }
    if (chain.limitVal !== null) {
      result = result.slice(0, chain.limitVal);
    }

    return result;
  }

  if (chain.operation === 'insert') {
    const insertedRows: any[] = [];
    
    for (const val of chain.valuesList) {
      const newRow = { ...val };
      
      if (newRow.id === undefined) {
        newRow.id = tableName.slice(0, 4) + "-" + Math.random().toString(36).substr(2, 9);
      }
      
      if (newRow.createdAt === undefined) {
        newRow.createdAt = new Date().toISOString();
      }
      if (newRow.updatedAt === undefined) {
        newRow.updatedAt = new Date().toISOString();
      }

      rows.push(newRow);
      insertedRows.push(newRow);
    }

    saveDb(dbData);
    return insertedRows;
  }

  if (chain.operation === 'update') {
    const updatedRows: any[] = [];
    const updateVal = chain.valuesList[0] || {};

    for (let i = 0; i < rows.length; i++) {
      if (!chain.whereCond || evaluateCondition(rows[i], chain.whereCond)) {
        rows[i] = {
          ...rows[i],
          ...updateVal,
          updatedAt: new Date().toISOString()
        };
        updatedRows.push(rows[i]);
      }
    }

    saveDb(dbData);
    return updatedRows;
  }

  if (chain.operation === 'delete') {
    const deletedRows: any[] = [];
    const remainingRows: any[] = [];

    for (const row of rows) {
      if (!chain.whereCond || evaluateCondition(row, chain.whereCond)) {
        deletedRows.push(row);
      } else {
        remainingRows.push(row);
      }
    }

    dbData[tableName] = remainingRows;
    saveDb(dbData);
    return deletedRows;
  }

  return [];
}

class QueryChain {
  public operation: 'select' | 'insert' | 'update' | 'delete';
  public table: any;
  public selectFields: any = null;
  public valuesList: any[] = [];
  public whereCond: any = null;
  public limitVal: number | null = null;
  public offsetVal: number | null = null;
  public joins: any[] = [];

  constructor(operation: 'select' | 'insert' | 'update' | 'delete', table?: any, selectFields?: any) {
    this.operation = operation;
    this.table = table;
    this.selectFields = selectFields;
  }

  from(table: any) {
    this.table = table;
    return this;
  }

  leftJoin(table: any, condition: any) {
    this.joins.push({ type: 'left', table, condition });
    return this;
  }

  innerJoin(table: any, condition: any) {
    this.joins.push({ type: 'inner', table, condition });
    return this;
  }

  where(condition: any) {
    this.whereCond = condition;
    return this;
  }

  values(data: any) {
    this.valuesList = Array.isArray(data) ? data : [data];
    return this;
  }

  set(data: any) {
    this.valuesList = [data];
    return this;
  }

  limit(val: number) {
    this.limitVal = val;
    return this;
  }

  offset(val: number) {
    this.offsetVal = val;
    return this;
  }

  orderBy(...args: any[]) {
    return this;
  }

  onConflictDoNothing() {
    return this;
  }

  onConflictDoUpdate(config: any) {
    return this;
  }

  returning() {
    return this;
  }

  async then(resolve: any, reject?: any) {
    try {
      const result = await executeQuery(this);
      return resolve(result);
    } catch (err) {
      if (reject) return reject(err);
      throw err;
    }
  }

  async catch(reject: any) {
    return this.then((val: any) => val, reject);
  }
}

if (process.env.DATABASE_URL) {
  try {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzle(pool, { schema });
  } catch (err) {
    console.warn("[AI Studio] Database connection failed:", err);
  }
}

if (!db) {
  console.warn("[AI Studio] DATABASE_URL is not set or connection failed — using local JSON file-based persistent db fallback");
  
  pool = {
    end: async () => {
      console.log("[Fallback DB] Pool ending (no-op)");
    }
  };

  db = {
    select: (fields?: any) => new QueryChain('select', null, fields),
    insert: (table: any) => new QueryChain('insert', table),
    update: (table: any) => new QueryChain('update', table),
    delete: (table: any) => new QueryChain('delete', table)
  };

  const dbData = loadDb();
  if (!dbData.stores || dbData.stores.length === 0) {
    if (!seedingPromise) {
      console.log("[Fallback DB] Database is empty. Running automatic seed...");
      seedingPromise = (async () => {
        isSeeding = true;
        try {
          const { seed } = await import("./seed");
          await seed();
          console.log("[Fallback DB] Automatic seed completed successfully!");
        } catch (err) {
          console.error("[Fallback DB] Failed to run automatic seed:", err);
        } finally {
          isSeeding = false;
        }
      })();
    }
  }
}

export { pool, db };
export * from "./schema/index";

