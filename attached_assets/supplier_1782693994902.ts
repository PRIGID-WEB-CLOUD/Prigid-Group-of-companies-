import { SupplierProvider } from './suppliers/base';
import { eproloProvider } from './suppliers/eprolo';

export type { SupplierOrderPayload } from './suppliers/base';

export const getSupplierProvider = (supplierName: string): SupplierProvider => {
  switch (supplierName.toLowerCase()) {
    case 'eprolo':
      return eproloProvider;
    default:
      throw new Error(`Supplier provider ${supplierName} not implemented`);
  }
};

export const createEproloOrder = eproloProvider.createOrder;
export const payEproloOrder = eproloProvider.payOrder;
