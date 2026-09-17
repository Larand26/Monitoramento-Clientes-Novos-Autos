import { logger } from "../utils/logger.js";
import type { ErrorResponse } from "../interfaces/error.type.js";
import type { Response } from "../interfaces/response.type.js";
import type { ClientMagento } from "../interfaces/client.type.js";

import { getClientsMagento as getClientsService } from "../services/clientsService.js";
import { saveClientsToCRM as saveClientsToCRMService } from "../services/clientsService.js";
import { saveClientsToDatabase as saveClientsToDatabaseService } from "../services/clientsService.js";
import { getClientsFromDatabase as getClientsFromDatabaseService } from "../services/clientsService.js";
import { getClientsWithOrdersInBatches as getClientsWithOrdersInBatchesService } from "../services/clientsService.js";
import { updateClientsStatusInDatabase as updateClientsStatusInDatabaseService } from "../services/clientsService.js";
import { updateOrdersInDatabase as updateOrdersInDatabaseService } from "../services/clientsService.js";

export async function getClientsMagento(): Promise<Response | ErrorResponse> {
  try {
    return await getClientsService();
  } catch (error) {
    logger.error("Error fetching clients from Magento:");
    return {
      success: false,
      code: "ERR_MAGENTO_FETCH",
      message: "Erro ao buscar clientes do Magento.",
      archive: "clientsController.ts",
      error: error,
    };
  }
}

export async function saveClientsToCRM(
  clients: ClientMagento[],
): Promise<Response | ErrorResponse> {
  try {
    return await saveClientsToCRMService(clients);
  } catch (error) {
    logger.error("Error saving clients to CRM:");
    return {
      success: false,
      code: "ERR_CRM_SAVE",
      message: "Erro ao salvar clientes no CRM.",
      archive: "clientsController.ts",
      error: error,
    };
  }
}

export async function saveClientsToDatabase(
  clients: ClientMagento[],
): Promise<Response | ErrorResponse> {
  try {
    return await saveClientsToDatabaseService(clients);
  } catch (error) {
    logger.error("Error saving clients to database:");
    return {
      success: false,
      code: "ERR_DB_SAVE",
      message: "Erro ao salvar clientes no banco de dados.",
      archive: "clientsController.ts",
      error: error,
    };
  }
}

export async function getClientsFromDatabase(): Promise<
  Response | ErrorResponse
> {
  try {
    return await getClientsFromDatabaseService();
  } catch (error) {
    logger.error("Error fetching clients from database:");
    return {
      success: false,
      code: "ERR_DB_FETCH",
      message: "Erro ao buscar clientes do banco de dados.",
      archive: "clientsController.ts",
      error: error,
    };
  }
}

export async function getClientsWithOrdersInBatches(
  clients: any[],
): Promise<Response | ErrorResponse> {
  try {
    return await getClientsWithOrdersInBatchesService(clients);
  } catch (error) {
    logger.error("Error fetching clients with orders in batches:");
    return {
      success: false,
      code: "ERR_BATCH_FETCH",
      message: "Erro ao buscar clientes com pedidos em lotes.",
      archive: "clientsController.ts",
      error: error,
    };
  }
}

export async function updateClientsStatusInDatabase(
  clients: any[],
): Promise<Response | ErrorResponse> {
  try {
    return await updateClientsStatusInDatabaseService(clients);
  } catch (error) {
    logger.error("Error updating clients status in database:");
    return {
      success: false,
      code: "ERR_DB_UPDATE",
      message: "Erro ao atualizar status dos clientes no banco de dados.",
      archive: "clientsController.ts",
      error: error,
    };
  }
}

export async function updateOrdersInDatabase(
  clients: any[],
): Promise<Response | ErrorResponse> {
  try {
    return await updateOrdersInDatabaseService(clients);
  } catch (error) {
    logger.error("Error updating orders in database:");
    return {
      success: false,
      code: "ERR_DB_UPDATE_ORDERS",
      message: "Erro ao atualizar pedidos no banco de dados.",
      archive: "clientsController.ts",
      error: error,
    };
  }
}

export async function getClientsStore(): Promise<Response | ErrorResponse> {
  try {
    return await getClientsService();
  } catch (error) {
    logger.error("Error fetching clients from store:");
    return {
      success: false,
      code: "ERR_STORE_FETCH",
      message: "Erro ao buscar clientes da loja.",
      archive: "clientsController.ts",
      error: error,
    };
  }
}
