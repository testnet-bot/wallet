import { defineConfig } from "prisma/config";

import "dotenv/config"; 

export default defineConfig({
  // Point to your schema location
    schema: "prisma/schema.prisma",
   datasource: {
    url: process.env.DATABASE_URL,
          },
    
        // Ensure migrations stay next to the schema
          migrations: {
              path: "prisma/migrations",
                },
                });
