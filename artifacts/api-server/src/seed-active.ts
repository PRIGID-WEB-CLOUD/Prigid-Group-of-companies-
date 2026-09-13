
import { db, productsTable, categoriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function main() {
  // Ensure we have a category
  let [cat] = await db.select().from(categoriesTable).limit(1);
  if (!cat) {
    [cat] = await db.insert(categoriesTable).values({
      name: "Apparel",
      slug: "apparel",
      description: "Apparel category"
    }).returning();
  }

  // Create an active product
  await db.insert(productsTable).values({
    name: "Luxury Silk Dress",
    slug: "luxury-silk-dress",
    description: "A beautiful silk dress",
    price: 1500,
    stock: 10,
    status: "ACTIVE",
    categoryId: cat.id,
    imageUrl: "/images/dress1.jpg"
  });
  
  console.log("Seeded active product.");
}

main().catch(console.error);
