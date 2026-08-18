import mongoose from "mongoose";

const sellerSchema = new mongoose.Schema({
  name: { type: String, required: true },
});

const SellerModel = mongoose.model("Seller", sellerSchema, "sellers");
export default SellerModel;
