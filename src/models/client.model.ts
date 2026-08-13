import mongoose from "mongoose";

const clientSchema = new mongoose.Schema({
  magento_id: { type: String, required: true },
  rd_station_id: { type: String, required: false },
  store_id: { type: String, required: false },
  name: { type: String, required: true },
  cnpj: { type: String, required: true },
  seller_id: { type: Number, required: false },
  magento_order_ids: { type: Array<String>, required: false },
  store_order_ids: { type: Array<String>, required: false },
  status: { type: String, required: true, enum: ["IN_CRM", "LOST", "SUCCESS"] },
  projected_profit: { type: Number, required: false },
  created_at: { type: Date, required: true },
  updated_at: { type: Date, required: true },
});

const ClientModel = mongoose.model("Client", clientSchema, "clients");
export default ClientModel;
