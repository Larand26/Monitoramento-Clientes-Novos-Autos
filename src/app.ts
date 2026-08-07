// Controllers
import { getClientsMagento } from "./controllers/clientsController";

export async function ingestNewCustomers() {
  // Busca clientes no Magento
  const clients = await getClientsMagento();
  // Salva eles no CRM
  // Salva eles no banco de dados via api
}
