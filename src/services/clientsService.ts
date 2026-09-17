import { logger } from "../utils/logger.js";
import type { ErrorResponse } from "../interfaces/error.type";
import type { Response } from "../interfaces/response.type";
import type { ClientMagento } from "../interfaces/client.type";

import ClientModel from "../models/client.model.js";
import SellerModel from "../models/seller.model.js";
import HistoryModel from "../models/history.model.js";
import OrderModel from "../models/order.model.js";

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

    // Remove os clientes que tem @b2b no email
    const filteredClients = clients.filter(
      (client) => !client.email.includes("@b2b"),
    );

    return {
      success: true,
      message: "Clientes buscados com sucesso.",
      data: filteredClients,
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

        // Busca pelo CNPJ para garantir que não haja duplicidade[cite: 5]
        const c = await mongodb.findOneData(
          ClientModel,
          { cnpj: cnpjLimpo }, // <-- Busca atualizada para usar o CNPJ[cite: 5]
          "clients",
        );

        if (c) {
          logger.info(
            `Cliente ${client.firstname} já existe no banco de dados (CNPJ: ${cnpjLimpo}).`,
          );
          return { success: true, data: c };
        }

        const data = {
          magento_id: String(client.id) || null,
          rd_station_id: client.organizationId || null,
          name: client.firstname,
          cnpj: cnpjLimpo,
          status: "IN_CRM",
          created_at: new Date(client.created_at),
          updated_at: new Date(client.updated_at),
          avg_days_between_purchases: 20,
          projected_profit: 0,
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
            `${appConfig.internalApi.url}/get-orders/${utils.cleanCnpj(client.cnpj)}`,
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
    const historyRecords: any[] = [];
    const now = new Date();

    const updatedClientsList = clients.map((c) => {
      const client = c._doc ? c._doc : c;
      const hasOrders = (c.hasOrders || []) as any[];

      let avg_days_between_purchases = 20;
      let lastReferenceDate = new Date(client.updated_at);

      // Regra 1: Cálculo da Média de Dias (avg_days_between_purchases)
      if (hasOrders.length === 0) {
        avg_days_between_purchases = 20;
      } else if (hasOrders.length === 1) {
        avg_days_between_purchases = 20;
        lastReferenceDate = new Date(
          hasOrders[0].order_date || client.updated_at,
        );
      } else {
        // Ordenar pedidos garantindo fallback para data 0 caso seja undefined
        const sortedOrders = [...hasOrders].sort((a, b) => {
          const timeA = a.order_date ? new Date(a.order_date).getTime() : 0;
          const timeB = b.order_date ? new Date(b.order_date).getTime() : 0;
          return timeA - timeB;
        });

        // Tenta pegar a data do último pedido, faz fallback para updated_at se for inválido
        const lastOrderDateStr =
          sortedOrders[sortedOrders.length - 1].order_date;
        const parsedLastDate = lastOrderDateStr
          ? new Date(lastOrderDateStr)
          : new Date(client.updated_at);
        lastReferenceDate = isNaN(parsedLastDate.getTime())
          ? new Date(client.updated_at)
          : parsedLastDate;

        let totalDaysDiff = 0;
        let validIntervals = 0;

        for (let i = 1; i < sortedOrders.length; i++) {
          const prevDateStr = sortedOrders[i - 1].order_date;
          const currDateStr = sortedOrders[i].order_date;

          if (prevDateStr && currDateStr) {
            const prevDate = new Date(prevDateStr).getTime();
            const currDate = new Date(currDateStr).getTime();

            // Só calcula a diferença se ambas as datas forem válidas
            if (!isNaN(prevDate) && !isNaN(currDate)) {
              const diffTime = Math.abs(currDate - prevDate);
              const diffDays = diffTime / (1000 * 60 * 60 * 24);
              totalDaysDiff += diffDays;
              validIntervals++;
            }
          }
        }

        if (validIntervals > 0) {
          const rawAvg = totalDaysDiff / validIntervals;
          // Se por acaso ainda der NaN (ex: divisão por zero não mapeada), fallback para 20
          avg_days_between_purchases = isNaN(rawAvg) ? 20 : Math.round(rawAvg);
        } else {
          // Se não houver intervalos válidos com datas, assume o padrão
          avg_days_between_purchases = 20;
        }
      }

      // Regra 2: Atualização de Status e Vencimento
      const deadline = new Date(lastReferenceDate);
      deadline.setDate(deadline.getDate() + avg_days_between_purchases);

      // Diferença em dias entre a Data Limite e hoje
      const daysUntilDeadline =
        (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

      let newStatus = client.status;
      let isExpiringSoon = false;

      if (daysUntilDeadline < 0) {
        // Data atual é maior que a Data Limite
        newStatus = "LOST";
      } else {
        // Está dentro do prazo.
        // Se houver pedidos e o status não for SUCCESS, atualiza para SUCCESS.
        if (hasOrders.length > 0 && client.status !== "SUCCESS") {
          newStatus = "SUCCESS";
        }

        // Se estiver faltando 3 dias ou menos para a Data Limite, muda para FREEZE
        if (daysUntilDeadline <= 3) {
          newStatus = "FREEZE";
          isExpiringSoon = true;
          logger.info(
            `Aviso: Cliente ${client.name} (Magento ID: ${client.magento_id}) está quase vencendo! Faltam ${Math.max(0, Math.ceil(daysUntilDeadline))} dias (Data Limite: ${deadline.toISOString().split("T")[0]}). Status alterado para FREEZE.`,
          );
        }
      }

      const updateFields: any = {
        status: newStatus,
        avg_days_between_purchases: avg_days_between_purchases,
        updated_at: now,
      };

      // Atualiza projected_profit somando os valores caso o cliente tenha pedidos
      if (hasOrders.length > 0) {
        updateFields.projected_profit = hasOrders.reduce(
          (acc, order) => acc + (Number(order.total_value) || 0),
          0,
        );
        updateFields.store_id =
          String(hasOrders[0]?.entity_id) || client.store_id;
      }

      logger.info(
        `Cliente ${client.name} (Magento ID: ${client.magento_id}) atualizado. Status: ${newStatus}, Dias até o vencimento: ${Math.max(
          0,
          Math.ceil(daysUntilDeadline),
        )}, Data Limite: ${deadline.toISOString().split("T")[0]}, Lucro Projetado: ${updateFields.projected_profit}`,
      );

      // Se o status mudou, enfileira o registro no histórico
      if (newStatus !== client.status) {
        historyRecords.push({
          client_id: client._id,
          previous_status: client.status,
          new_status: newStatus,
          changed_at: new Date(now),
        });
      }

      bulkOperations.push({
        updateOne: {
          filter: { _id: client._id },
          update: { $set: updateFields },
        },
      });

      return { ...client, ...updateFields, isExpiringSoon };
    });

    await Promise.all([
      bulkOperations.length > 0
        ? ClientModel.bulkWrite(bulkOperations)
        : Promise.resolve(),
      historyRecords.length > 0
        ? HistoryModel.insertMany(historyRecords)
        : Promise.resolve(),
    ]);

    return {
      success: true,
      message: "Status dos clientes atualizados com sucesso.",
      data: updatedClientsList,
    };
  } catch (error) {
    console.error(JSON.stringify(error));
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

export async function updateOrdersInDatabase(
  clients: any[],
): Promise<Response | ErrorResponse> {
  try {
    // 1. Coletar todos os IDs de pedidos (store_order_id) vindos dos clientes
    const allIncomingOrderIds = new Set<string>();
    clients.forEach((c) => {
      const hasOrders = (c.hasOrders || []) as any[];
      hasOrders.forEach((order) =>
        allIncomingOrderIds.add(String(order.order_id)),
      );
    });

    // 2. Buscar no banco de dados quais desses pedidos já existem
    const existingOrders = await OrderModel.find({
      store_order_id: { $in: Array.from(allIncomingOrderIds) },
    })
      .select("store_order_id")
      .lean();

    const existingOrderIds = new Set(
      existingOrders.map((o: any) => o.store_order_id),
    );

    // 3. Identificar quais vendedores precisamos buscar apenas para os pedidos NOVOS
    const sellerNamesToFetch = new Set<string>();
    clients.forEach((c) => {
      const hasOrders = (c.hasOrders || []) as any[];
      const newOrders = hasOrders.filter(
        (order) => !existingOrderIds.has(String(order.order_id)),
      );

      newOrders.forEach((order) => {
        const sellerName = order.seller_name?.trim();
        if (sellerName) sellerNamesToFetch.add(sellerName);
      });
    });

    // 4. Mapear os vendedores (seller_name -> seller_id)
    const sellerMap = new Map<string, any>();
    if (sellerNamesToFetch.size > 0) {
      const sellers = await SellerModel.find({
        name: { $in: Array.from(sellerNamesToFetch) },
      }).lean();

      sellers.forEach((seller: any) => {
        sellerMap.set(seller.name, seller._id);
      });
    }
    // 5. Montar a lista de pedidos a serem inseridos
    const ordersToInsert: any[] = [];

    clients.forEach((c) => {
      const client = c._doc ? c._doc : c;
      const hasOrders = (c.hasOrders || []) as any[];

      // Filtra usando o Set do banco de dados, ignorando client.store_order_ids
      const newOrders = hasOrders.filter(
        (order) => !existingOrderIds.has(String(order.order_id)),
      );

      newOrders.forEach((order) => {
        const sellerName = order.seller_name?.trim();
        const resolvedSellerId = sellerName
          ? sellerMap.get(sellerName)
          : client.seller_id;

        ordersToInsert.push({
          store_order_id: String(order.order_id),
          seller_id: resolvedSellerId || null,
          order_date: order.order_date || new Date().toISOString(),
          total_amount: Number(order.total_value) || 0,
          client_name: client.name,
          client_id: client._id,
        });
      });
    });
    // 6. Inserir todos os novos pedidos no banco (Bulk Insert)
    if (ordersToInsert.length > 0) {
      await OrderModel.insertMany(ordersToInsert);
      logger.info(`${ordersToInsert.length} novos pedidos inseridos no banco.`);
    }

    return {
      success: true,
      message: "Pedidos dos clientes atualizados com sucesso.",
      data: ordersToInsert,
    };
  } catch (error) {
    console.error(JSON.stringify(error));
    logger.error("Error updating orders in database:");
    return {
      success: false,
      code: "ERR_DB_UPDATE_ORDERS",
      message: "Erro ao atualizar pedidos dos clientes no banco de dados.",
      archive: "clientsService.ts",
      error: error,
    };
  }
}

export async function getClientsStore(): Promise<Response | ErrorResponse> {
  try {
    const response = await axios.get(
      `${appConfig.internalApi.url}/get-orders`,
      {
        headers: {
          Authorization: `Bearer ${appConfig.internalApi.token}`,
          "Content-Type": "application/json",
        },
      },
    );
    return {
      success: true,
      message: "Clientes da loja buscados com sucesso.",
      data: response.data,
    };
  } catch (error) {
    console.error(JSON.stringify(error));
    return {
      success: false,
      code: "ERR_STORE_FETCH",
      message: "Erro ao buscar clientes da loja.",
      archive: "clientsService.ts",
      error: error,
    };
  }
}
