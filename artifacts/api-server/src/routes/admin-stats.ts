import { Router } from "express";
import { db, ordersTable, productsTable, categoriesTable, usersTable } from "@workspace/db";
import { eq, desc, sql, or } from "drizzle-orm";
import { getSessionUser } from "../middleware/requireAdmin";

const router = Router();

/**
 * GET /api/admin/stats
 *
 * Returns a unified stats payload. The shape differs by role:
 *  - SUPER_ADMIN → full financials + customer + team panels
 *  - ADMIN       → operational snapshot (orders queue + catalog health)
 */
router.get("/admin/stats", async (req, res) => {
  const user = await getSessionUser(req);
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    return res.status(403).json({ error: "Admin access required." });
  }

  const isSuperAdmin = user.role === "SUPER_ADMIN";

  // ── Shared: orders + products ──────────────────────────────────────────────

  const [orders, products] = await Promise.all([
    db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt)),
    db.select().from(productsTable),
  ]);

  const totalRevenue   = orders.reduce((s, o) => s + (o.total ?? 0), 0);
  const totalOrders    = orders.length;
  const avgOrderValue  = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const pendingOrders  = orders.filter((o) => o.status === "PENDING").length;
  const recentOrders   = orders.slice(0, 5);

  // Status breakdown
  const statusBreakdown: Record<string, number> = {};
  for (const o of orders) {
    statusBreakdown[o.status] = (statusBreakdown[o.status] ?? 0) + 1;
  }

  // Low-stock products (stock < 5, tracked)
  const lowStockProducts = products
    .filter((p) => p.trackQuantity && p.stock < 5 && p.status === "ACTIVE")
    .map((p) => ({ id: p.id, name: p.name, stock: p.stock }));

  const base = {
    role:            user.role,
    totalRevenue,
    totalOrders,
    avgOrderValue,
    pendingOrders,
    recentOrders,
    statusBreakdown,
    productCount:    products.length,
    lowStockProducts,
  };

  if (!isSuperAdmin) return res.json(base);

  // ── SUPER_ADMIN extras ─────────────────────────────────────────────────────

  // Revenue by month (last 6 months)
  const revenueByMonth: Record<string, number> = {};
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toLocaleString("en-US", { month: "short", year: "2-digit" });
    revenueByMonth[key] = 0;
  }
  for (const o of orders) {
    const d = new Date(o.createdAt);
    const key = d.toLocaleString("en-US", { month: "short", year: "2-digit" });
    if (key in revenueByMonth) revenueByMonth[key] += o.total ?? 0;
  }

  // Total registered users + admins count
  const [{ totalUsers }] = await db
    .select({ totalUsers: sql<number>`count(*)::int` })
    .from(usersTable)
    .where(eq(usersTable.role, "CUSTOMER"));

  const [{ adminCount }] = await db
    .select({ adminCount: sql<number>`count(*)::int` })
    .from(usersTable)
    .where(or(eq(usersTable.role, "ADMIN"), eq(usersTable.role, "SUPER_ADMIN")));

  // Top products by appearance in orders (via items jsonb)
  const productSales: Record<string, { name: string; revenue: number; units: number }> = {};
  for (const o of orders) {
    for (const item of (o.items as Array<{ name: string; qty: number; price: number }> ?? [])) {
      if (!productSales[item.name]) productSales[item.name] = { name: item.name, revenue: 0, units: 0 };
      productSales[item.name].revenue += item.price * item.qty;
      productSales[item.name].units   += item.qty;
    }
  }
  const topProducts = Object.values(productSales)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // Categories count
  const categories = await db.select().from(categoriesTable);

  return res.json({
    ...base,
    revenueByMonth,
    totalUsers:   totalUsers ?? 0,
    adminCount:   adminCount ?? 0,
    topProducts,
    categoryCount: categories.length,
  });
});

export default router;
