export interface SupplierConfig {
  apiKey: string;
  apiSecret: string;
}

export interface SupplierOrderPayload {
  orderId: string;
  customer: {
    name: string;
    phone: string;
    address: string;
    city: string;
    province: string;
    provinceCode: string;
    postCode: string;
    country: string;
    countryCode: string;
  };
  items: {
    variantId: string;
    quantity: number;
  }[];
}

export interface SupplierProvider {
  name: string;
  getCategories(config: SupplierConfig, id?: string): Promise<any>;
  getSubCategories(config: SupplierConfig, id?: string, typeid?: string): Promise<any>;
  getDetailedProductList(config: SupplierConfig, params: any): Promise<any>;
  getProductDetail(config: SupplierConfig, id: string, productId: string): Promise<any>;
  getShippingFees(config: SupplierConfig, productId: string, variantId: string, countryCode?: string): Promise<any>;
  importAliExpressProduct(config: SupplierConfig, url: string): Promise<any>;
  getProducts(config: SupplierConfig, limit?: number): Promise<any>;
  syncInventory(config: SupplierConfig): Promise<any>;
  importProduct(config: SupplierConfig, ids: string[]): Promise<any>;
  createOrder(config: SupplierConfig, payload: SupplierOrderPayload): Promise<string>;
  payOrder(config: SupplierConfig, supplierOrderId: string, total: number): Promise<any>;
  // New methods from documentation
  getOrderList(config: SupplierConfig, params: any): Promise<any>;
  addOrderItems(config: SupplierConfig, orderId: string, items: any[]): Promise<any>;
  deleteOrderItem(config: SupplierConfig, orderId: string, itemId: string, remark?: string): Promise<any>;
  modifyOrderItem(config: SupplierConfig, orderId: string, itemId: string, quantity: number): Promise<any>;
  cancelOrders(config: SupplierConfig, ids: string[], remark?: string): Promise<any>;
  modifyOrderNote(config: SupplierConfig, orderId: string, note: string): Promise<any>;
  modifyOrderAddress(config: SupplierConfig, orderId: string, payload: any): Promise<any>;
  setOrderException(config: SupplierConfig, orderId: string, status: 1 | 2, remark?: string): Promise<any>;
  getCostByProduct(config: SupplierConfig, payload: any): Promise<any>;
  getProductInventory(config: SupplierConfig, params: any): Promise<any>;
  getWebhookList(config: SupplierConfig): Promise<any>;
  addWebhook(config: SupplierConfig, url: string, signKey: string, type: number): Promise<any>;
  deleteWebhook(config: SupplierConfig, type: number): Promise<any>;
  verifyWebhookPayload(body: any, signKey: string, receivedSign: string): boolean;
}
