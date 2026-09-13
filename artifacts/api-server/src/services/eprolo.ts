import crypto from "crypto";

export interface EproloConfig {
  apiKey: string;
  apiSecret: string;
}

function generateAuth(config: EproloConfig) {
  const timestamp = Date.now().toString();
  const secretKey = config.apiKey + timestamp + config.apiSecret;
  const sign = crypto.createHash("md5").update(secretKey).digest("hex");
  return { timestamp, sign };
}

async function eproloRequest(
  endpoint: string,
  config: EproloConfig,
  method: "GET" | "POST" = "GET",
  body?: unknown,
) {
  const { timestamp, sign } = generateAuth(config);
  const url = new URL(`https://openapi.eprolo.com${endpoint}`);
  url.searchParams.append("sign", sign);
  url.searchParams.append("timestamp", timestamp);

  const headers: Record<string, string> = {
    apiKey: config.apiKey,
    "Content-Type": "application/json",
  };

  const options: RequestInit = { method, headers };
  if (body && method === "POST") options.body = JSON.stringify(body);

  const response = await fetch(url.toString(), options);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  const data = await response.json() as Record<string, any>;

  if (data.code !== "0" && data.code !== 0) {
    throw new Error(data.msg || `Eprolo error code ${data.code}`);
  }
  return data.data ?? data;
}

export const eprolo = {
  /** Verify credentials work — fetches one product from the catalog */
  async testConnection(config: EproloConfig): Promise<{ ok: boolean; message: string }> {
    try {
      await eproloRequest("/eprolo_product_list.html?page_size=1", config);
      return { ok: true, message: "Connected to Eprolo successfully!" };
    } catch (err: unknown) {
      return { ok: false, message: err instanceof Error ? err.message : "Connection failed" };
    }
  },

  /** Browse the Eprolo product catalog */
  async getProducts(config: EproloConfig, params: { page_size?: number; page_num?: number; typeid?: string } = {}) {
    const qs = new URLSearchParams(
      Object.entries({ page_size: "20", page_num: "1", ...params }).reduce<Record<string, string>>((a, [k, v]) => {
        a[k] = String(v); return a;
      }, {})
    ).toString();
    const data = await eproloRequest(`/eprolo_product_list.html?${qs}`, config);
    return Array.isArray(data) ? data : data?.list ?? data?.productList ?? [];
  },

  /** Get detailed info for a single product */
  async getProductDetail(config: EproloConfig, id: string, productId: string) {
    return eproloRequest(`/getproduct.html?id=${id}&product_id=${productId}`, config);
  },

  /** Fetch current stock levels for products already in the store */
  async syncInventory(config: EproloConfig) {
    const data = await eproloRequest("/product_inventory.html?page_size=200", config);
    return Array.isArray(data) ? data : data?.list ?? [];
  },

  /** Get top-level product categories */
  async getCategories(config: EproloConfig) {
    return eproloRequest("/product_type.html", config);
  },

  /** Import an Eprolo product into the merchant's store */
  async importProduct(config: EproloConfig, ids: string[]) {
    return eproloRequest("/add_product.html", config, "POST", { ids });
  },

  /** Verify an incoming Eprolo webhook signature */
  verifyWebhook(rawBody: string, signKey: string, receivedSign: string): boolean {
    const computed = crypto.createHash("md5").update(rawBody + signKey).digest("hex");
    return computed.toLowerCase() === receivedSign.toLowerCase();
  },

  /** Create a fulfillment order in Eprolo */
  async createOrder(config: EproloConfig, payload: {
    orderId: string;
    customer: { name: string; phone: string; address: string; city: string; province: string; provinceCode: string; postCode: string; country: string; countryCode: string };
    items: { variantId: string; quantity: number }[];
  }) {
    const body = {
      shipping_country_code: payload.customer.countryCode,
      shipping_name:         payload.customer.name,
      shipping_phone:        payload.customer.phone,
      shipping_country:      payload.customer.country,
      shipping_address:      payload.customer.address,
      shipping_province:     payload.customer.province,
      shipping_province_code:payload.customer.provinceCode,
      shipping_city:         payload.customer.city,
      shipping_post_code:    payload.customer.postCode,
      order_id:              payload.orderId,
      order_number:          payload.orderId.slice(0, 8),
      tax_cost:              0,
      orderItemlist:         payload.items.map(i => ({ variantsid: i.variantId, quantity: i.quantity })),
    };
    const data = await eproloRequest("/add_order.html", config, "POST", body);
    return data?.orderid ?? data;
  },
};
