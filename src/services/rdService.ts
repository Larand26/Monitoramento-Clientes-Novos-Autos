import axios from "axios";
import appConfig from "../config/app.config.js";

import { logger } from "../utils/logger.js";

import { findOneData, updateData } from "../db/mongodb.js";
import RdTokenModel from "../models/rdToken.model.js";

import type { ClientMagento } from "../interfaces/client.type.js";

interface ItokenData {
  access_token: string;
  refresh_token: string;
  expires_at: Date;
}

const customFieldsSlugs = ["cnpj", "cidade", "estado", "razao-social"];

export async function getRdToken(): Promise<string | null> {
  try {
    const tokenData: ItokenData | null = await findOneData(
      RdTokenModel,
      {},
      "rd_token",
    );

    if (!tokenData) {
      return null;
    }

    const accessToken = tokenData.access_token;
    const currentTime = new Date();
    if (tokenData.expires_at > currentTime) {
      return accessToken;
    }

    const refreshToken = tokenData.refresh_token;
    const body = new URLSearchParams();
    body.append("client_id", appConfig.rd.clientId);
    body.append("client_secret", appConfig.rd.clientSecret);
    body.append("refresh_token", refreshToken);
    body.append("grant_type", "refresh_token");

    const response = await axios.post(
      "https://api.rd.services/oauth2/token",
      body,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );

    const newTokenData: ItokenData = {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      expires_at: new Date(Date.now() + response.data.expires_in * 500),
    };

    await updateData(RdTokenModel, {}, newTokenData, "rd_token");

    return newTokenData.access_token;
  } catch (error) {
    logger.error("Error occurred while fetching RD token:");
    throw error;
  }
}

export async function getOrganizationIdByName(
  token: string,
  organizationName: string,
): Promise<string | null> {
  try {
    const response = await axios.get(
      `${appConfig.rd.url}/crm/v2/organizations`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        params: {
          "page[number]": 1,
          "page[size]": 1,
          filter: `name:"${organizationName}"`,
        },
      },
    );

    if (response.data && response.data.data && response.data.data.length > 0) {
      return response.data.data[0].id;
    } else {
      return null;
    }
  } catch (error) {
    logger.error("Error occurred while fetching organization ID by name:");
    throw error;
  }
}

export async function createOrganization(
  token: string,
  client: ClientMagento,
): Promise<string> {
  try {
    const body: any = {
      data: {
        name: client.firstname,
        owner_id: appConfig.rd.ownerId,
        custom_fields: {
          cnpj: client.taxvat,
          cidade: client.addresses?.[0]?.city || "",
          estado: client.addresses?.[0]?.region?.region_code || "",
          "razao-social": client.firstname,
        },
        address: {
          line: client.addresses?.[0]?.street?.join(" ") || "",
        },
      },
    };

    const response = await axios.post(
      `${appConfig.rd.url}/crm/v2/organizations`,
      body,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    return response.data.data.id;
  } catch (error) {
    logger.error("Error occurred while creating organization:");
    throw error;
  }
}

export async function getDealIdByOrganizationId(
  token: string,
  organizationId: string,
): Promise<string | null> {
  try {
    const response = await axios.get(`${appConfig.rd.url}/crm/v2/deals`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      params: {
        "page[number]": 1,
        "page[size]": 1,
        filter: `organization_id:${organizationId}`,
      },
    });
    if (response.data && response.data.data && response.data.data.length > 0) {
      return response.data.data[0].id;
    } else {
      return null;
    }
  } catch (error) {
    logger.error("Error occurred while fetching deal ID by organization ID:");
    throw error;
  }
}

export async function createDeal(
  token: string,
  organizationId: string,
  contactId: string,
  client: ClientMagento,
): Promise<string> {
  try {
    const body = {
      data: {
        name: client.firstname,
        status: "ongoing",
        stage_id: appConfig.rd.dealStageId,
        owner_id: appConfig.rd.ownerId,
        organization_id: organizationId,
        contact_ids: [contactId],
      },
    };

    const response = await axios.post(
      `${appConfig.rd.url}/crm/v2/deals`,
      body,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );
    return response.data.data.id;
  } catch (error) {
    logger.error("Error occurred while creating deal:");
    throw error;
  }
}

export async function getContactIdByOrganizationId(
  token: string,
  organizationId: string,
): Promise<string | null> {
  try {
    const response = await axios.get(`${appConfig.rd.url}/crm/v2/contacts`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      params: {
        "page[number]": 1,
        "page[size]": 1,
        filter: `organization_id:${organizationId}`,
      },
    });
    if (response.data && response.data.data && response.data.data.length > 0) {
      return response.data.data[0].id;
    } else {
      return null;
    }
  } catch (error) {
    logger.error("Error occurred while fetching contact ID by name:");
    throw error;
  }
}

export async function createContact(
  token: string,
  client: ClientMagento,
): Promise<string> {
  try {
    const body = {
      data: {
        name: client.firstname,
        emails: [{ email: client.email }],
        phones: [
          { phone: client.addresses?.[0]?.telephone || "", type: "mobile" },
        ],
      },
    };

    const response = await axios.post(
      `${appConfig.rd.url}/crm/v2/contacts`,
      body,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );
    return response.data.data.id;
  } catch (error) {
    logger.error("Error occurred while creating contact:");
    throw error;
  }
}
