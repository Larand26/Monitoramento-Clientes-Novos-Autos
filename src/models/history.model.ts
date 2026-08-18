import mongoose from "mongoose";

const historySchema = new mongoose.Schema({
  client_id: { type: String, required: true },
  previous_status: { type: String, required: false },
  new_status: { type: String, required: false },
  changed_at: { type: String, required: true },
  order_value: { type: Number, required: false },
  order_id: { type: String, required: false },
});

const HistoryModel = mongoose.model("History", historySchema, "status_history");
export default HistoryModel;
