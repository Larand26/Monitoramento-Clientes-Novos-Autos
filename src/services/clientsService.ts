import { logger } from "../utils/logger.js";
import type { ErrorResponse } from "../interfaces/error.type";
import type { Response } from "../interfaces/response.type";
import type { ClientMagento } from "../interfaces/client.type";

import * as utils from "../utils/utils.js";
import * as rdService from "../services/rdService.js";

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

    const clients: ClientMagento[] = response.data.items || [];

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
  clients: ClientMagento[],
): Promise<Response | ErrorResponse> {
  try {
    // Busca o token de autenticação do CRM
    const rdToken = await rdService.getRdToken();

    if (!rdToken) {
      logger.error("Error fetching RD Station token");
      return {
        success: false,
        code: "ERR_RD_TOKEN",
        message: "Erro ao buscar token do RD Station.",
        archive: "clientsService.ts",
        error: "Token não encontrado.",
      };
    }

    const updatedClients = await Promise.all(
      clients.map(async (client) => {
        let organizationId: string | null = null;
        let contactId: string | null = null;
        let dealId: string | null = null;

        // Busca o cliente (organization) no CRM
        organizationId = await rdService.getOrganizationIdByName(
          rdToken,
          client.firstname,
        );

        // Se o cliente (organization) não existir, cria ele no CRM
        if (!organizationId) {
          organizationId = await rdService.createOrganization(rdToken, client);
        }

        // Busca o contato (Contacts) no CRM
        contactId = await rdService.getContactIdByOrganizationId(
          rdToken,
          organizationId,
        );

        // Se o contato (Contacts) não existir, cria ele no CRM
        if (!contactId) {
          contactId = await rdService.createContact(rdToken, client);
        }

        // Busca a negociação (deal) no CRM
        dealId = await rdService.getDealIdByOrganizationId(
          rdToken,
          organizationId,
        );

        if (!dealId) {
          // Cria a negociação (deal) no CRM
          dealId = await rdService.createDeal(
            rdToken,
            organizationId,
            contactId,
            client,
          );
        }

        logger.info(
          `Organization ID para ${client.firstname}: ${organizationId}`,
        );
        logger.info(`Contact ID para ${client.firstname}: ${contactId}`);
        logger.info(`Deal ID para ${client.firstname}: ${dealId}`);

        return {
          ...client,
          organizationId,
        };
      }),
    );
    return {
      success: true,
      message: "Clientes salvos no CRM com sucesso.",
      data: updatedClients,
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
