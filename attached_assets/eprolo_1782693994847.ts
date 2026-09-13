import crypto from 'crypto';
import { SupplierConfig, SupplierOrderPayload, SupplierProvider } from './base';

function generateEproloAuth(config: SupplierConfig) {
  const timestamp = new Date().getTime().toString();
  const secretKey = config.apiKey + timestamp + config.apiSecret;
  const sign = crypto.createHash('md5').update(secretKey).digest('hex');
  return { timestamp, sign };
}

async function eproloRequest(endpoint: string, config: SupplierConfig, method: 'GET' | 'POST' = 'GET', body?: any) {
  const { timestamp, sign } = generateEproloAuth(config);
  const url = new URL(`https://openapi.eprolo.com${endpoint}`);
  url.searchParams.append('sign', sign);
  url.searchParams.append('timestamp', timestamp);

  const headers: Record<string, string> = {
    'apiKey': config.apiKey,
    'Content-Type': 'application/json'
  };

  const options: RequestInit = { method, headers };
  if (body && method === 'POST') options.body = JSON.stringify(body);

  const response = await fetch(url.toString(), options);
  const data = await response.json();
  if (data.code !== "0" && data.code !== 0) {
    throw new Error(`Eprolo Error: ${data.msg || JSON.stringify(data)}`);
  }
  return data.data;
}

export const eproloProvider: SupplierProvider = {
  name: 'Eprolo',
  
  async getCategories(config: SupplierConfig, id?: string) {
    const endpoint = id ? `/product_type.html?id=${id}` : '/product_type.html';
    return await eproloRequest(endpoint, config);
  },

  async getSubCategories(config: SupplierConfig, id?: string, typeid?: string) {
    const params = new URLSearchParams();
    if (id) params.append('id', id);
    if (typeid) params.append('typeid', typeid);
    return await eproloRequest(`/product_type_two.html?${params.toString()}`, config);
  },

  async getDetailedProductList(config: SupplierConfig, params: any = {}) {
    const query = new URLSearchParams(params).toString();
    return await eproloRequest(`/product_list.html?${query}`, config);
  },

  async getProductDetail(config: SupplierConfig, id: string, productId: string) {
    return await eproloRequest(`/getproduct.html?id=${id}&product_id=${productId}`, config);
  },

  async getShippingFees(config: SupplierConfig, productId: string, variantId: string, countryCode?: string) {
    const query = new URLSearchParams({ productid: productId, variantId: variantId });
    if (countryCode) query.append('countrycode', countryCode);
    return await eproloRequest(`/get_product_shiping_fees.html?${query.toString()}`, config);
  },

  async importAliExpressProduct(config: SupplierConfig, url: string) {
    return await eproloRequest(`/import_smt_prodcut.html?url=${encodeURIComponent(url)}`, config);
  },

  async getProducts(config: SupplierConfig, limit = 20) {
    // This fetches all products on the EPROLO platform
    const data = await eproloRequest(`/eprolo_product_list.html?page_size=${limit}`, config);
    return data || [];
  },

  async syncInventory(config: SupplierConfig) {
    // This fetches inventory data for products added to the store
    // Use the optimized inventory endpoint which returns actual warehouse stock levels
    const data = await eproloRequest('/product_inventory.html?page_size=200', config);
    return data || [];
  },

  async importProduct(config: SupplierConfig, ids: string[]) {
    return await eproloRequest('/add_product.html', config, 'POST', { ids });
  },

  async getOrderList(config: SupplierConfig, params: any) {
    const query = new URLSearchParams(params).toString();
    return await eproloRequest(`/order_list.html?${query}`, config);
  },

  async addOrderItems(config: SupplierConfig, orderId: string, items: any[]) {
    return await eproloRequest('/add_order_item.html', config, 'POST', { orderid: orderId, items });
  },

  async deleteOrderItem(config: SupplierConfig, orderId: string, itemId: string, remark?: string) {
    return await eproloRequest('/delete_order_item.html', config, 'POST', { id: itemId, orderid: orderId, remark });
  },

  async modifyOrderItem(config: SupplierConfig, orderId: string, itemId: string, quantity: number) {
    return await eproloRequest('/modify_order_item.html', config, 'POST', { orderid: orderId, order_itemid: itemId, quantity });
  },

  async cancelOrders(config: SupplierConfig, ids: string[], remark?: string) {
    return await eproloRequest('/cancel_orders.html', config, 'POST', { ids, remark });
  },

  async modifyOrderNote(config: SupplierConfig, orderId: string, note: string) {
    return await eproloRequest('/modify_note.html', config, 'POST', { orderid: orderId, note });
  },

  async modifyOrderAddress(config: SupplierConfig, orderId: string, payload: any) {
    return await eproloRequest('/modify_order_address.html', config, 'POST', { ...payload, orderid: orderId });
  },

  async setOrderException(config: SupplierConfig, orderId: string, status: 1 | 2, remark?: string) {
    return await eproloRequest('/order_exception.html', config, 'POST', { orderid: orderId, status, remark });
  },

  async getCostByProduct(config: SupplierConfig, payload: any) {
    return await eproloRequest('/getCostByProduct.html', config, 'POST', payload);
  },

  async getProductInventory(config: SupplierConfig, params: any) {
    const query = new URLSearchParams(params).toString();
    return await eproloRequest(`/product_inventory.html?${query}`, config);
  },

  async getWebhookList(config: SupplierConfig) {
    return await eproloRequest('/shop_webhook_list.html', config);
  },

  async addWebhook(config: SupplierConfig, url: string, signKey: string, type: number) {
    return await eproloRequest('/add_shop_webhook.html', config, 'POST', { url, sign_key: signKey, type });
  },

  async deleteWebhook(config: SupplierConfig, type: number) {
    return await eproloRequest('/delete_shop_webhook.html', config, 'POST', { type });
  },

  verifyWebhookPayload(body: any, signKey: string, receivedSign: string): boolean {
    const payloadString = typeof body === 'string' ? body : JSON.stringify(body);
    const computedSign = crypto.createHash('md5').update(payloadString + signKey).digest('hex');
    return computedSign.toLowerCase() === receivedSign.toLowerCase();
  },

  async createOrder(config: SupplierConfig, payload: SupplierOrderPayload): Promise<string> {
    const eproloPayload = {
      shipping_country_code: payload.customer.countryCode,
      shipping_name: payload.customer.name,
      shipping_phone: payload.customer.phone,
      shipping_country: payload.customer.country,
      shipping_address: payload.customer.address,
      shipping_province: payload.customer.province,
      shipping_province_code: payload.customer.provinceCode,
      shipping_city: payload.customer.city,
      shipping_post_code: payload.customer.postCode,
      order_id: payload.orderId,
      order_number: payload.orderId.split('-')[0],
      tax_cost: 0, // Defaulting to 0 if not provided in payload
      orderItemlist: payload.items.map(item => ({
        variantsid: item.variantId,
        quantity: item.quantity
      }))
    };
    const data = await eproloRequest('/add_order.html', config, 'POST', eproloPayload);
    return data.orderid || data;
  },

  async payOrder(config: SupplierConfig, supplierOrderId: string, total: number) {
    await eproloRequest('/pay_order.html', config, 'POST', {
      operate: 'pre',
      pay_subtotal: total,
      orderlist: [{ orderid: supplierOrderId, logistics_id: 10 }]
    });
    return await eproloRequest('/pay_order.html', config, 'POST', {
      operate: 'pay',
      pay_subtotal: total,
      orderlist: [{ orderid: supplierOrderId, logistics_id: 10 }]
    });
  }
};
