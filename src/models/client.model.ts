import mongoose from "mongoose";

const clientSchema = new mongoose.Schema({
  magento_id: { type: String, required: true },
  rd_station_id: { type: String, required: false },
  store_id: { type: String, required: false },
  name: { type: String, required: true },
  cnpj: { type: String, required: true },
  seller_id: { type: mongoose.Types.ObjectId, required: false },
  status: {
    type: String,
    required: true,
    enum: ["IN_CRM", "LOST", "SUCCESS", "FREEZE"],
  },
  projected_profit: { type: Number, required: false },
  created_at: { type: Date, required: true },
  updated_at: { type: Date, required: true },
  avg_days_between_purchases: { type: Number, required: true },
});

const ClientModel = mongoose.model("Client", clientSchema, "clients");
export default ClientModel;
