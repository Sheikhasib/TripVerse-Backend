import app from "./app";
import config from "./config";
import { prisma } from "./lib/prisma";
import "dotenv/config";

const PORT = config.port;

const main = async () => {
  try {
    // Connect to the database
    await prisma.$connect();
    console.log("Connected to the database successfully.");

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
