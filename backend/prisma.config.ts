/// <reference types="node" />
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"] ?? "mysql://root:@localhost:3306/perfumes_db",
  },
  seed: {
    run: "ts-node prisma/seed.ts",
  },
});
