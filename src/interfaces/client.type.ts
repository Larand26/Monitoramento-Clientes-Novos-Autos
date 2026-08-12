export interface ClientMagento {
  id: number;
  group_id: number;
  default_billing: string;
  default_shipping: string;
  created_at: string;
  updated_at: string;
  created_in: string;
  email: string;
  firstname: string;
  lastname: string;
  store_id: number;
  taxvat: string;
  website_id: number;
  addresses: any[];
  disable_auto_group_change: number;
  extension_attributes: { is_subscribed: boolean };
  custom_attributes: { attribute_code: string; value: string }[];
}
