import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: ".local/islamia-printers-dev.sqlite",
  },
  strict: true,
  verbose: true,
});
