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
    console.log("Checking if showroom_locations table exists...");
    const checkRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'showroom_locations'
    `);

    if (checkRes.rowCount === 0) {
      console.log("Creating showroom_locations table...");
      await pool.query(`
        CREATE TABLE showroom_locations (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          address TEXT NOT NULL,
          city TEXT NOT NULL,
          country TEXT NOT NULL,
          phone TEXT NOT NULL DEFAULT '',
          email TEXT NOT NULL DEFAULT '',
          hours TEXT NOT NULL DEFAULT '',
          image_url TEXT NOT NULL DEFAULT '',
          active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      console.log("Table created successfully.");

      // Let's insert some default locations to populate the database
      console.log("Seeding default showroom locations...");
      const defaultLocations = [
        {
          id: "loc-london",
          name: "The London Atelier",
          address: "14 Savile Row, Mayfair",
          city: "London",
          country: "United Kingdom",
          phone: "+44 20 7946 0192",
          email: "london@luxe-boutique.com",
          hours: "Monday – Saturday: 10:00 AM – 7:00 PM | Sunday: By Appointment Only",
          imageUrl: "https://images.unsplash.com/photo-1541807084-5c52b6b3adef?q=80&w=600&auto=format&fit=crop"
        },
        {
          id: "loc-paris",
          name: "The Paris Salon",
          address: "32 Rue du Faubourg Saint-Honoré, 8th Arr.",
          city: "Paris",
          country: "France",
          phone: "+33 1 42 68 53 00",
          email: "paris@luxe-boutique.com",
          hours: "Monday – Saturday: 10:00 AM – 7:00 PM | Sunday: Closed",
          imageUrl: "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?q=80&w=600&auto=format&fit=crop"
        },
        {
          id: "loc-milan",
          name: "The Milan Galleria",
          address: "Via Monte Napoleone, 8",
          city: "Milan",
          country: "Italy",
          phone: "+39 02 7600 1234",
          email: "milan@luxe-boutique.com",
          hours: "Monday – Saturday: 10:00 AM – 7:30 PM | Sunday: 11:00 AM – 6:00 PM",
          imageUrl: "https://images.unsplash.com/photo-1520175480921-4edfa2983e0f?q=80&w=600&auto=format&fit=crop"
        },
        {
          id: "loc-newyork",
          name: "The New York Residence",
          address: "743 Madison Avenue, Upper East Side",
          city: "New York",
          country: "United States",
          phone: "+1 212 555 0198",
          email: "newyork@luxe-boutique.com",
          hours: "Monday – Saturday: 10:00 AM – 6:00 PM | Sunday: 12:00 PM – 5:00 PM",
          imageUrl: "https://images.unsplash.com/photo-1485871981521-5b1fd3805eee?q=80&w=600&auto=format&fit=crop"
        }
      ];

      for (const loc of defaultLocations) {
        await pool.query(`
          INSERT INTO showroom_locations (id, name, address, city, country, phone, email, hours, image_url, active)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [loc.id, loc.name, loc.address, loc.city, loc.country, loc.phone, loc.email, loc.hours, loc.imageUrl, true]);
      }
      console.log("Seeding completed successfully.");
    } else {
      console.log("Table already exists.");
    }
  } catch (err) {
    console.error("Error updating schema:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
