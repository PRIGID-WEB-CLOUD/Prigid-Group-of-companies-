import { NextResponse } from 'next/server';
import { createAdminClient } from '@/src/lib/supabase/admin';
import { getSupplierProvider } from '@/src/services/supplier';
import { getVaultSecret } from '@/src/lib/supabase/vault';

async function getAdminEproloConfig() {
  const supabase = createAdminClient();
  const { data: settings } = await supabase.from('settings').select('value').eq('key', 'eprolo_api_key').single();
  const apiKey = settings?.value;
  const apiSecret = await getVaultSecret('supplier_api_secret');
  
  if (!apiKey || !apiSecret) return null;
  return { apiKey, apiSecret };
}

export async function POST() {
  try {
    const config = await getAdminEproloConfig();
    if (!config) return NextResponse.json({ success: false, message: 'Config missing' }, { status: 400 });

    const provider = getSupplierProvider('eprolo');
    const products = await provider.syncInventory(config);

    const supabase = createAdminClient();
    
    // Iterate and update stock for dropship products
    for (const prod of products) {
        const stockValue = prod.num !== undefined ? Number(prod.num) : (prod.stock !== undefined ? Number(prod.stock) : 0);
        const productId = prod.productid || prod.id;

        if (productId) {
            await supabase
                .from('products')
                .update({ stock_quantity: stockValue })
                .eq('eprolo_id', productId);
        }
    }

    return NextResponse.json({ success: true, message: `Synced ${products.length} products.` });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
