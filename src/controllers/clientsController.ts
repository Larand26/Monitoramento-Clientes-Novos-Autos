import { logger } from "../utils/logger";
import type { ErrorResponse } from "../interfaces/error.type";
import type { Response } from "../interfaces/response.type";

import { getClientsMagento as getClientsService } from "../services/clientsService";

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
