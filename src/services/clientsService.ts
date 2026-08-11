import { logger } from "../utils/logger.js";
import type { ErrorResponse } from "../interfaces/error.type";
import type { Response } from "../interfaces/response.type";

import * as utils from "../utils/utils.js";

import appConfig from "../config/app.config.js";

import axios from "axios";

export async function getClientsMagento(): Promise<Response | ErrorResponse> {
  try {
    const now = new Date();

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    // Lógica para buscar clientes no Magento
    const response = await axios.get(
      `${appConfig.magento.url}/rest/V1/customers/search`,
      {
        headers: {
          Authorization: `Bearer ${appConfig.magento.token}`,
          "Content-Type": "application/json",
        },
        params: {
          // Pega os clientes do grupo Comum
          "searchCriteria[filterGroups][0][filters][0][field]": "group_id",
          "searchCriteria[filterGroups][0][filters][0][value]":
            appConfig.app.groupId,
          "searchCriteria[filterGroups][0][filters][0][conditionType]": "eq",

          // Pega clientes criados a partir de ontem
          "searchCriteria[filterGroups][1][filters][0][field]": "created_at",
          "searchCriteria[filterGroups][1][filters][0][value]":
            utils.formatDateToISO(yesterday),
          "searchCriteria[filterGroups][1][filters][0][conditionType]": "from",
        },
      },
    );

    const clients: any[] = response.data.items || [];

    return {
      success: true,
      message: "Clientes buscados com sucesso.",
      data: clients,
    };
  } catch (error) {
    logger.error("Error fetching clients from Magento:");
    return {
      success: false,
      code: "ERR_MAGENTO_FETCH",
      message: "Erro ao buscar clientes do Magento.",
      archive: "clientsService.ts",
      error: error,
    };
  }
}

export async function saveClientsToCRM(
  clients: any[],
): Promise<Response | ErrorResponse> {
  try {
    // Lógica para salvar clientes no CRM
    // Retorna uma resposta de sucesso
    return {
      success: true,
      message: "Clientes salvos no CRM com sucesso.",
      data: clients,
    };
  } catch (error) {
    logger.error("Error saving clients to CRM:");
    return {
      success: false,
      code: "ERR_CRM_SAVE",
      message: "Erro ao salvar clientes no CRM.",
      archive: "clientsService.ts",
      error: error,
    };
  }
}
