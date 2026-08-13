import { logger } from "../utils/logger.js";
import type { ErrorResponse } from "../interfaces/error.type";
import type { Response } from "../interfaces/response.type";
import type { ClientMagento } from "../interfaces/client.type";

import ClientModel from "../models/client.model.js";

import * as utils from "../utils/utils.js";
import * as rdService from "../services/rdService.js";
import * as mongodb from "../db/mongodb.js";

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

export async function saveClientsToDatabase(
  clients: ClientMagento[],
): Promise<Response | ErrorResponse> {
  try {
    // 1. Guardamos o resultado de todas as operações
    const results = await Promise.all(
      clients.map(async (client) => {
        // Proteção caso taxvat venha nulo/undefined
        const cnpjLimpo = client.taxvat
          ? client.taxvat.replace(/[^a-zA-Z0-9]/g, "")
          : "";

        const c = await mongodb.findOneData(
          ClientModel,
          { magento_id: String(client.id) },
          "clients",
        );

        if (c) {
          logger.info(
            `Cliente ${client.firstname} já existe no banco de dados.`,
          );
          return { success: true, data: c };
        }

        const data = {
          magento_id: String(client.id),
          rd_station_id: client.organizationId || null,
          name: client.firstname,
          cnpj: cnpjLimpo,
          status: "IN_CRM",
          created_at: new Date(client.created_at),
          updated_at: new Date(client.updated_at),
        };

        try {
          await mongodb.insertData(ClientModel, data, "clients");
          return { success: true, data: data };
        } catch (error) {
          // Passamos o 'error' real para o logger
          logger.error(`Erro ao inserir cliente ${client.id} no DB`);
          return { success: false, error: { data, error } };
        }
      }),
    );
    const failedInserts = results.filter((res) => res.success === false);

    if (failedInserts.length > 0) {
      return {
        success: false,
        code: "ERR_DB_INSERT_PARTIAL",
        message: `Atenção: ${failedInserts.length} cliente(s) falharam ao salvar no banco.`,
        archive: "clientsService.ts",
        error: failedInserts, // Retorna quais falharam para debugar
      };
    }

    // 3. Se passou direto, todos deram certo
    return {
      success: true,
      message: "Todos os clientes foram salvos no banco de dados com sucesso.",
      data: results,
    };
  } catch (error) {
    // Esse catch agora pega erros gerais (ex: falha de rede, erro no map, etc)
    logger.error("Erro geral ao processar clientes para o banco");
    return {
      success: false,
      code: "ERR_DB_SAVE",
      message: "Erro catastrófico ao salvar clientes no banco de dados.",
      archive: "clientsService.ts",
      error: error,
    };
  }
}

export async function getClientsFromDatabase(): Promise<
  Response | ErrorResponse
> {
  try {
    const clients = await mongodb.findData(ClientModel, {}, "clients");

    return {
      success: true,
      data: clients,
    };
  } catch (error) {
    logger.error("Error fetching clients from database:");
    return {
      success: false,
      code: "ERR_DB_FETCH",
      message: "Erro ao buscar clientes do banco de dados.",
      archive: "clientsService.ts",
      error: error,
    };
  }
}

export async function getClientsWithOrdersInBatches(
  clients: any[],
  batchSize: number = 100,
): Promise<Response | ErrorResponse> {
  try {
    const clientsWithOrders = [];

    for (let i = 0; i < clients.length; i += batchSize) {
      const batch = clients.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map(async (client) => {
          const response = await axios.get(
            `${appConfig.internalApi.url}/get-orders/${client.cnpj}`,
            {
              headers: {
                Authorization: `Bearer ${appConfig.internalApi.token}`,
                "Content-Type": "application/json",
              },
            },
          );
          return { ...client, hasOrders: response.data };
        }),
      );
      clientsWithOrders.push(...batchResults);
    }
    return {
      success: true,
      data: clientsWithOrders,
    };
  } catch (error) {
    console.error(error);
    logger.error("Error fetching clients with orders in batches:");
    return {
      success: false,
      code: "ERR_BATCH_FETCH",
      message: "Erro ao buscar clientes com pedidos em lotes.",
      archive: "clientsService.ts",
      error: error,
    };
  }
}

export async function updateClientsStatusInDatabase(
  clients: any[],
): Promise<Response | ErrorResponse> {
  try {
    const bulkOperations: any[] = [];
    const now = new Date();
    const timeLostInMs = parseInt(appConfig.app.timeLost) * 24 * 60 * 60 * 1000;

    // 1. Processa todos os clientes de forma síncrona (não precisa mais de Promise.all)
    const updatedClientsList = clients.map((c) => {
      const client = c._doc ? c._doc : c;
      const updatedAt = new Date(client.updated_at);
      const hasOrders = (c.hasOrders || []) as {
        order_id: number;
        total_value: number;
      }[];

      // Verifica se existem novos pedidos
      const newOrders = hasOrders.filter((order) => {
        return !client.store_order_ids.includes(String(order.order_id));
      });

      // Caso 1: Não faz nada
      if (
        newOrders.length === 0 &&
        updatedAt.getTime() + timeLostInMs > now.getTime()
      ) {
        return client;
      }

      // Caso 2: Atualiza o status para "LOST"
      if (
        newOrders.length === 0 &&
        updatedAt.getTime() + timeLostInMs < now.getTime()
      ) {
        // Prepara a instrução para o MongoDB (mas não executa ainda)
        bulkOperations.push({
          updateOne: {
            filter: { magento_id: client.magento_id },
            update: { $set: { status: "LOST", updated_at: now } },
          },
        });

        return { ...client, status: "LOST" };
      }

      // Caso 3: Atualiza o status para "SUCCESS"
      if (newOrders.length > 0) {
        const currentProfit = Number(client.projected_profit) || 0;
        const additionalProfit = newOrders.reduce((acc, order) => {
          return acc + (Number(order.total_value) || 0);
        }, 0);
        const newProjectedProfit = currentProfit + additionalProfit;

        const newOrderIds = newOrders.map((order) => String(order.order_id));
        const updatedOrderIdsList = [...client.store_order_ids, ...newOrderIds];

        // Prepara a instrução para o MongoDB (mas não executa ainda)
        bulkOperations.push({
          updateOne: {
            filter: { magento_id: client.magento_id },
            update: {
              $set: {
                status: "SUCCESS",
                projected_profit: newProjectedProfit,
                store_order_ids: updatedOrderIdsList,
                updated_at: now,
              },
            },
          },
        });

        return {
          ...client,
          status: "SUCCESS",
          projected_profit: newProjectedProfit,
          store_order_ids: updatedOrderIdsList,
        };
      }

      return client; // Fallback de segurança
    });

    // 2. Executa todas as atualizações no banco de dados de UMA SÓ VEZ
    if (bulkOperations.length > 0) {
      await ClientModel.bulkWrite(bulkOperations);
    }

    // 3. Retorna os dados processados para a API
    return {
      success: true,
      message: "Status dos clientes atualizados com sucesso.",
      data: updatedClientsList,
    };
  } catch (error) {
    console.error(error);
    logger.error("Error updating clients status in database:");
    return {
      success: false,
      code: "ERR_DB_UPDATE",
      message: "Erro ao atualizar status dos clientes no banco de dados.",
      archive: "clientsService.ts",
      error: error,
    };
  }
}
