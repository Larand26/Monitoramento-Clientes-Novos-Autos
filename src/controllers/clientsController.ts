import { logger } from "../utils/logger.js";
import type { ErrorResponse } from "../interfaces/error.type.js";
import type { Response } from "../interfaces/response.type.js";

import { getClientsMagento as getClientsService } from "../services/clientsService.js";

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
