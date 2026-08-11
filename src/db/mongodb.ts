import mongoose from "mongoose";
import appConfig from "../config/app.config.js";

const mongoURI = appConfig.mongodb.uri;

export async function connectToMongoDB(): Promise<void> {
  try {
    await mongoose.connect(mongoURI);
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    throw error;
  }
}

export async function disconnectFromMongoDB(): Promise<void> {
  try {
    await mongoose.disconnect();
  } catch (error) {
    console.error("Error disconnecting from MongoDB:", error);
    throw error;
  }
}

export async function insertData(
  model: mongoose.Model<any>,
  data: any,
  collectionName: string,
): Promise<void> {
  try {
    const modelCollection = model.collection.name;

    if (collectionName && collectionName !== modelCollection) {
      throw new Error(
        `Collection mismatch: received '${collectionName}', but model writes to '${modelCollection}'`,
      );
    }

    const newData = new model(data);
    await newData.save();
  } catch (error) {
    console.error("Error adding data to MongoDB:", error);
    throw error;
  }
}

export async function findData(
  model: mongoose.Model<any>,
  query: any,
  collectionName: string,
): Promise<any[]> {
  try {
    const modelCollection = model.collection.name;
    if (collectionName && collectionName !== modelCollection) {
      throw new Error(
        `Collection mismatch: received '${collectionName}', but model writes to '${modelCollection}'`,
      );
    }

    const data = await model.find(query);
    return data;
  } catch (error) {
    console.error("Error finding data in MongoDB:", error);
    throw error;
  }
}

export async function updateData(
  model: mongoose.Model<any>,
  query: any,
  update: any,
  collectionName: string,
): Promise<void> {
  try {
    const modelCollection = model.collection.name;
    if (collectionName && collectionName !== modelCollection) {
      throw new Error(
        `Collection mismatch: received '${collectionName}', but model writes to '${modelCollection}'`,
      );
    }
    await model.updateOne(query, update);
  } catch (error) {
    console.error("Error updating data in MongoDB:", error);
    throw error;
  }
}

export async function deleteData(
  model: mongoose.Model<any>,
  query: any,
  collectionName: string,
): Promise<void> {
  try {
    const modelCollection = model.collection.name;
    if (collectionName && collectionName !== modelCollection) {
      throw new Error(
        `Collection mismatch: received '${collectionName}', but model writes to '${modelCollection}'`,
      );
    }
    await model.deleteOne(query);
  } catch (error) {
    console.error("Error deleting data in MongoDB:", error);
    throw error;
  }
}
