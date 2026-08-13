import { logger } from "./utils/logger.js";

// Controllers
import * as clientsController from "./controllers/clientsController.js";

export async function ingestNewCustomers() {
  // Busca clientes no Magento
  const clients = await clientsController.getClientsMagento();

  if (!clients.success || !("data" in clients)) {
    logger.warning("Nenhum cliente encontrado no Magento.");
    return;
  }
  logger.info(`Clientes encontrados no Magento: ${clients.data.length}`);

  // Salva eles no CRM
  const saveResponse = await clientsController.saveClientsToCRM(clients.data);

  if (!saveResponse.success) {
    logger.error(
      `Erro ao salvar clientes no CRM: ${saveResponse.message} - ${saveResponse.code}`,
    );
    return;
  }

  // Salva eles no banco de dados
  const dbResponse = await clientsController.saveClientsToDatabase(
    saveResponse.data,
  );

  if (!dbResponse.success) {
    logger.error(
      `Erro ao salvar clientes no banco de dados: ${dbResponse.message} - ${dbResponse.code}`,
    );
    return;
  }

  console.log(`Clientes salvos no banco de dados: ${dbResponse.data.length}`);
}

export async function updateClients() {
  // Busca clientes no Banco de Dados
  const clientsResponse = await clientsController.getClientsFromDatabase();
  if (!clientsResponse.success || !("data" in clientsResponse)) {
    logger.warning("Nenhum cliente encontrado no banco de dados.");
    return;
  }
  // Verifica se ele tem Pedidos na Loja em lotes
  const clientsWithOrdersResponse =
    await clientsController.getClientsWithOrdersInBatches(clientsResponse.data);

  if (
    !clientsWithOrdersResponse.success ||
    !("data" in clientsWithOrdersResponse)
  ) {
    logger.warning("Nenhum cliente com pedidos encontrado.");
    return;
  }

  // Atualiza o status do cliente no banco de dados
  const updateResponse = await clientsController.updateClientsStatusInDatabase(
    clientsWithOrdersResponse.data,
  );
}
