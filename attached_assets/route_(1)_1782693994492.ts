import { NextResponse } from 'next/server';
import { getSupplierProvider } from '@/src/services/supplier';
import { SupplierConfig } from '@/src/services/suppliers/base';

async function getEproloConfig(): Promise<SupplierConfig> {
  const apiKey = process.env.EPROLO_API_KEY;
  const apiSecret = process.env.EPROLO_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error('Please configure EPROLO_API_KEY and EPROLO_API_SECRET in your AI Studio Settings > API Keys/Secrets.');
  }
  return { apiKey, apiSecret };
}

export async function GET() {
  try {
    const config = await getEproloConfig();
    const provider = getSupplierProvider('eprolo');
    const products = await provider.getProducts(config);
    return NextResponse.json({ success: true, products });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
