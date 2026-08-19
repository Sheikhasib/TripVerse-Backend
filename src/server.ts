import app from "./app";
import config from "./config";
import { prisma } from "./lib/prisma";
import { redisClient } from "./lib/redis";
import "dotenv/config";

const PORT = config.port;

const main = async () => {
  try {
    // Connect to the database
    await prisma.$connect();
    console.log("Connected to the database successfully.");

    // Connect to Redis (email-verification OTP store, Step 21) — guarded so a
    // missing/unreachable Redis never blocks the app from booting.
    if (redisClient) {
      try {
        await redisClient.connect();
        console.log("Connected to Redis successfully.");
      } catch (error) {
        console.error("Failed to connect to Redis:", error);
      }
    }

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Error starting server:", error);

    // Disconnect from the database
    await prisma.$disconnect();
    process.exit(1); // Exit with failure code
  }
};

main();
