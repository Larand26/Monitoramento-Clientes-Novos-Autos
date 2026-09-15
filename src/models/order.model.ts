import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
  store_order_id: { type: String, required: true },
  seller_id: { type: mongoose.Schema.Types.ObjectId, required: false },
  order_date: { type: String, required: false },
  total_amount: { type: Number, required: true },
  client_name: { type: String, required: false },
  client_id: { type: mongoose.Schema.Types.ObjectId, required: false },
});

const OrderModel = mongoose.model("Order", orderSchema, "orders");
export default OrderModel;
