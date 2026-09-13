import fs from "fs";

let content = fs.readFileSync("artifacts/api-server/src/routes/store.ts", "utf-8");

const oldUsersEndpoint = `router.get("/users", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt));
  const customers = new Map<string, { id: string; name: string; email: string; totalOrders: number; totalSpent: number; createdAt: Date }>();
  for (const order of rows) {
    const current = customers.get(order.customerEmail);
    if (current) {
      current.totalOrders += 1;
      current.totalSpent += Number(order.total);
      if (order.createdAt < current.createdAt) current.createdAt = order.createdAt;
    } else {
      customers.set(order.customerEmail, {
        id: order.customerId ?? order.customerEmail,
        name: order.customerName,
        email: order.customerEmail,
        totalOrders: 1,
        totalSpent: Number(order.total),
        createdAt: order.createdAt,
      });
    }
  }
  return res.json([...customers.values()]);
});`;

const newUsersEndpoint = `router.get("/users", requireAdmin, async (_req, res) => {
  const allUsers = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
  return res.json(allUsers);
});

router.delete("/users/bulk", requireAdmin, async (req, res) => {
  const { ids } = req.body as { ids?: string[] };
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "No user IDs provided" });
  }
  try {
    await db.delete(usersTable).where(inArray(usersTable.id, ids));
    return res.json({ success: true, message: \`Deleted \${ids.length} users\` });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.put("/users/bulk", requireAdmin, async (req, res) => {
  const { ids, role } = req.body as { ids?: string[], role?: string };
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "No user IDs provided" });
  }
  if (!role) {
    return res.status(400).json({ error: "No role provided to update" });
  }
  try {
    await db.update(usersTable).set({ role }).where(inArray(usersTable.id, ids));
    return res.json({ success: true, message: \`Updated \${ids.length} users\` });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.delete("/users/:id", requireAdmin, async (req, res) => {
  const userId = req.params.id as string;
  try {
    await db.delete(usersTable).where(eq(usersTable.id, userId));
    return res.json({ success: true, message: "User deleted" });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});`;

content = content.replace(oldUsersEndpoint, newUsersEndpoint);

fs.writeFileSync("artifacts/api-server/src/routes/store.ts", content);
