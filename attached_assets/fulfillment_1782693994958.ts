import { createClient } from '@/src/lib/supabase/server';
import { createAdminClient } from '@/src/lib/supabase/admin';
import { sendOrderConfirmationWhatsApp, sendShippingUpdateWhatsApp } from '@/src/lib/whatsapp';
import { createEproloOrder, payEproloOrder, SupplierOrderPayload } from '@/src/services/supplier';
import { getVaultSecret } from '@/src/lib/supabase/vault';

// Helps get Eprolo Config from vault
async function getAdminEproloConfig() {
  const supabase = createAdminClient();
  const { data: settings } = await supabase.from('settings').select('value').eq('key', 'eprolo_api_key').single();
  const apiKey = settings?.value;
  const apiSecret = await getVaultSecret('supplier_api_secret');
  
  if (!apiKey || !apiSecret) return null;
  return { apiKey, apiSecret };
}

export async function forwardOrderToSuppliers(orderId: string) {
  // Use admin client for automated forwarding to avoid RLS delays
  const supabase = createAdminClient();

  // 1. Get order items and their suppliers
  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .select('*, profiles(phone)')
    .eq('id', orderId)
    .limit(1)
    .maybeSingle();

  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select(`
      quantity,
      price_at_purchase,
      product_name_snapshot,
      products (
        id,
        name,
        cost_price,
        category,
        variants
      )
    `)
    .eq('order_id', orderId);

  if (itemsError || !items || !orderData) {
    console.error('Error fetching order items for fulfillment:', itemsError?.message);
    return;
  }

  // 2. Send WhatsApp Confirmation to Customer if phone exists
  if (orderData.profiles?.phone) {
    try {
      await sendOrderConfirmationWhatsApp(
        orderData.profiles.phone,
        orderId,
        `$${orderData.total_amount.toString()}` // Using standard USD/currency stringification
      );
    } catch(e) {
      console.error("WhatsApp error silently ignored during fulfillment:", e);
    }
  }

  // 3. Extract purely Eprolo products (Category: Dropship)
  const eproloItems = items.filter(item => (item.products as any)?.category === 'Dropship');
  
  if (eproloItems.length > 0) {
    const eproloConfig = await getAdminEproloConfig();
    
    if (eproloConfig) {
      try {
        console.log(`Processing Eprolo Dropshipping for order ${orderId}...`);
        
        // Format shipping address based on what we saved in the DB
        // Assuming shipping_address is JSONB with standard fields or fallback strings
        const address = orderData.shipping_address || {};
        
        // Eprolo Order Payload mapping
        const eproloPayload: SupplierOrderPayload = {
          orderId: orderId,
          customer: {
            name: address.name || 'Valued Customer',
            phone: address.phone || (orderData.profiles as any)?.phone || '0000000000',
            address: `${address.line1}${address.line2 ? ', ' + address.line2 : ''}`,
            city: address.city || 'New York',
            province: address.state || 'New York',
            provinceCode: address.state || address.state_code || 'NY',
            postCode: address.postal_code || '10001',
            country: address.country || 'United States',
            countryCode: address.country_code || address.country || 'US',
          },
          items: eproloItems.map(item => {
             // For Eprolo we need "variantId".
             const variantId = (item.products as any)?.variants?.[0]?.eprolo_variant_id || (item.products as any)?.id || '33216056411'; 
             return {
               variantId,
               quantity: item.quantity
             };
          })
        };

        // Trigger Eprolo API (1) Create Order
        const eproloOrderId = await createEproloOrder(eproloConfig, eproloPayload);

        // Calculate expected wholesale cost
        const expectedTotalCost = eproloItems.reduce((acc, item) => acc + ((item.products as any).cost_price * item.quantity), 0);
        
        // Trigger Eprolo API (2) Pay for the Order
        await payEproloOrder(eproloConfig, eproloOrderId, expectedTotalCost);

        // Log to Supplier Orders Table
        await supabase.from('supplier_orders').insert({
          order_id: orderId,
          status: 'forwarded',
          cost_total: expectedTotalCost
        });

        console.log(`Successfully completed Eprolo cycle for ${orderId}`);
      } catch(error: any) {
        console.error('Failed to auto-fulfill via Eprolo:', error.message);
      }
    } else {
      console.warn("Eprolo keys not configured in Vault. Skipping automated fulfillment.");
    }
  }

  // Legacy fallback or generic supplier processing can persist here
  // ...

}

export async function updateTrackingInfo(supplierOrderId: string, trackingNumber: string, carrier: string) {
  // Webhooks use admin client to bypass user session requirement
  const supabase = createAdminClient();

  // 1. Update the supplier order
  const { data: supplierOrder, error: soError } = await supabase
    .from('supplier_orders')
    .update({
      tracking_number: trackingNumber,
      carrier: carrier,
      status: 'shipped',
      updated_at: new Date().toISOString(),
    })
    .eq('id', supplierOrderId)
    .select('*, orders(user_id, id)')
    .maybeSingle();

  if (soError || !supplierOrder) {
    console.error('Error updating tracking info:', soError?.message);
    return { success: false, error: soError?.message };
  }

  // 2. Check if all supplier orders for this main order are shipped
  const { data: allSupplierOrders } = await supabase
    .from('supplier_orders')
    .select('status')
    .eq('order_id', supplierOrder.order_id);

  const allShipped = allSupplierOrders?.every(so => so.status === 'shipped');

  if (allShipped) {
    // Update main order status to shipped
    await supabase
      .from('orders')
      .update({ status: 'shipped' })
      .eq('id', supplierOrder.order_id);
  }

  // 3. Notify Customer via WhatsApp if phone exists
  const { data: orderData } = await supabase
    .from('orders')
    .select('*, profiles(phone_number)')
    .eq('id', supplierOrder.order_id)
    .maybeSingle();

  if (orderData?.profiles?.phone_number) {
    await sendShippingUpdateWhatsApp(
      orderData.profiles.phone_number,
      orderData.id,
      trackingNumber,
      carrier
    );
  }

  console.log(`Notifying user ${supplierOrder.orders.user_id} that Order ${supplierOrder.orders.id} has shipped with tracking: ${trackingNumber}`);

  return { success: true };
}

