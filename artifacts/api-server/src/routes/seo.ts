import { Router, type Request, type Response } from "express";
import { db, productsTable, categoriesTable, blogPostsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const seoRouter = Router();

// ── GET /robots.txt & /api/robots.txt ───────────────────────────────────────
seoRouter.get(["/robots.txt", "/api/robots.txt"], (req: Request, res: Response) => {
  const host = req.get("host") || "luxeboutique.com";
  const protocol = req.protocol || "https";
  const baseUrl = `${protocol}://${host}`;

  const content = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/
Disallow: /checkout
Disallow: /account

Sitemap: ${baseUrl}/sitemap.xml
`;

  res.header("Content-Type", "text/plain");
  return res.send(content);
});

// ── GET /sitemap.xml & /api/sitemap.xml ──────────────────────────────────────
seoRouter.get(["/sitemap.xml", "/api/sitemap.xml"], async (req: Request, res: Response) => {
  try {
    const host = req.get("host") || "luxeboutique.com";
    const protocol = req.protocol || "https";
    const baseUrl = `${protocol}://${host}`;

    // Fetch active items from database
    const products = await db.select().from(productsTable).where(eq(productsTable.status, "ACTIVE")).catch(() => []);
    const categories = await db.select().from(categoriesTable).catch(() => []);
    const posts = await db.select().from(blogPostsTable).catch(() => []);

    const staticPages = [
      "",
      "/products",
      "/sustainability",
      "/shipping-returns",
      "/terms",
      "/privacy",
      "/contact",
      "/blog",
    ];

    let urls = staticPages.map((page) => `
  <url>
    <loc>${baseUrl}${page}</loc>
    <changefreq>${page === "" ? "daily" : "weekly"}</changefreq>
    <priority>${page === "" ? "1.0" : "0.8"}</priority>
  </url>`).join("");

    // Add Product URLs
    for (const p of products) {
      const updatedAt = p.updatedAt ? new Date(p.updatedAt).toISOString() : new Date().toISOString();
      urls += `
  <url>
    <loc>${baseUrl}/products/${p.id}</loc>
    <lastmod>${updatedAt}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`;
    }

    // Add Category URLs
    for (const c of categories) {
      urls += `
  <url>
    <loc>${baseUrl}/products?category=${c.id}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
    }

    // Add Blog Posts
    for (const post of posts) {
      const updatedAt = post.createdAt ? new Date(post.createdAt).toISOString() : new Date().toISOString();
      urls += `
  <url>
    <loc>${baseUrl}/blog/${post.slug || post.id}</loc>
    <lastmod>${updatedAt}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`;
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

    res.header("Content-Type", "application/xml");
    return res.send(xml);
  } catch (err) {
    console.error("Sitemap generation error:", err);
    res.status(500).send("<error>Failed to generate sitemap</error>");
  }
});

export default seoRouter;
