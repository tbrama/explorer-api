import "dotenv/config";
import { defineConfig } from "drizzle-kit";
export default defineConfig({
  out: "./dbexplorer",
  schema: "./src/db/schema",
  dialect: "mysql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
