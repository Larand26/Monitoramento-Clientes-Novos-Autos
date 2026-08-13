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

  // Salva eles no banco de dados via api
}
