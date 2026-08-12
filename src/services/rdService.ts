import axios from "axios";
import appConfig from "../config/app.config.js";

import { logger } from "../utils/logger.js";

import { connectToMongoDB, disconnectFromMongoDB } from "../db/mongodb.js";
import { findData, updateData } from "../db/mongodb.js";
import RdTokenModel from "../models/rdToken.model.js";

export async function getRdToken() {
  try {
    await connectToMongoDB();
    const tokenData = await findData(RdTokenModel, {}, "rd_token");
    console.log("Token data retrieved from MongoDB:", tokenData);
    return tokenData;
  } catch (error) {
    logger.error("Error occurred while fetching RD token:");
    throw error;
  } finally {
    await disconnectFromMongoDB();
  }
}
