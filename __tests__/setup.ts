import { beforeAll, afterAll, afterEach } from "vitest";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

beforeAll(async () => {
  // Ensure database connection is established
  await prisma.$connect();
});

afterEach(async () => {
  // Clean up test data after each test if needed
  // For now we'll keep data between tests since we're using the seeded data
});

afterAll(async () => {
  await prisma.$disconnect();
});
