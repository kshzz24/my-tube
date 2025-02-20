import { db } from "@/db";
import { categories } from "@/db/schema";

const categoryNames = [
  "Film & Animation",
  "Cars & Vehicles",
  "Music",
  "Pets & Animals",
  "Sports",
  "Travel & Events",
  "Gaming",
  "People & Blogs",
  "Comedy",
  "Entertainment",
  "News & Politics",
  "Howto & Style",
  "Education",
  "Science & Technology",
  "Nonprofits & Activism",
];

async function main() {
  console.log("Seeding categories");

  try {
    const values = categoryNames.map((name) => ({
      name,
      description: `Videos related to ${name.toLowerCase()}`,
    }));

    await db.insert(categories).values(values);
    console.log("categories seeded successfully");
  } catch (err) {
    console.log("Error seeding Categoies", err);
    process.exit(1);
  }
}

main();
