import dotenv from "dotenv";
dotenv.config();

export const appConfig = {
  app: {
    mode: process.env.MODE || "production",
    timeLost: process.env.TIME_LOST || "180",
    groupId: process.env.GROUP_ID || "1",
    cronIngest: process.env.CRON_INGEST || "0 0 * * *",
    cronUpdate: process.env.CRON_UPDATE || "0 0 * * *",
  },
  rd: {
    token: process.env.RD_TOKEN || "your_default_token",
    url: process.env.RD_BASE_URL || "https://crm.rdstation.com",
  },
  internalApi: {
    url: process.env.INTERNAL_API_URL || "http://localhost:3000",
    token: process.env.INTERNAL_API_TOKEN || "your_default_internal_token",
  },
  magento: {
    token: process.env.MAGENTO_ACCESS_TOKEN || "your_default_magento_token",
    url: process.env.MAGENTO_BASE_URL || "https://www.yourdomain.com.br",
  },
  newClientsApi: {
    url:
      process.env.NEW_CLIENTS_API_BASE_URL || "https://api.yourdomain.com.br",
    token:
      process.env.NEW_CLIENTS_API_TOKEN || "your_default_new_clients_token",
  },
  logger: {
    url: process.env.LOGGER_URL || "",
    active: process.env.LOGGER_ACTIVE === "true",
  },
};
