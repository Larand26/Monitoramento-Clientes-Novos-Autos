import appConfig from "./config/app.config.js";
import cron from "node-cron";

import {
  ingestNewCustomers,
  updateClients,
  ingestNewCustomersFromStore,
} from "./app.js";
import { connectToMongoDB } from "./db/mongodb.js";

(async () => {
  try {
    await connectToMongoDB();
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1);
  }
})();

cron.schedule(appConfig.app.cronIngest, async () => {
  console.log("Ingesting new customers...");
  await ingestNewCustomers();
});

cron.schedule(appConfig.app.cronUpdate, async () => {
  console.log("Updating clients...");
  await updateClients();
});

if (appConfig.app.mode === "development") {
  console.log("Running in development mode");
  await ingestNewCustomers();
  await ingestNewCustomersFromStore();
  await updateClients();
}
