import mongoose from "mongoose";

const rdTokenSchema = new mongoose.Schema(
  {
    access_token: {
      type: String,
      required: true,
    },
    refresh_token: {
      type: String,
      required: true,
    },
    expires_at: {
      type: Date,
      required: true,
    },
  },
  {
    collection: "rd_token",
  },
);

const RdTokenModel = mongoose.model("rd_token", rdTokenSchema, "rd_token");
export default RdTokenModel;
