import { NextResponse } from 'next/server';
import crypto from 'crypto';

// Matches Eprolo Docs payload
interface EproloWebhookPayload {
  order_id: string;
  line_items_ids: string[];
  tracking_number: string;
  tracking_company: string;
  tracking_channel?: string;
  tracking_url: string;
  stock_status: number;
  createtime: string;
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const md5sign = req.headers.get('md5sign');

    // Retrieve the secret we told Eprolo to use (we used our API Secret)
    const signKey = process.env.SUPPLIER_API_SECRET;

    if (!signKey) {
      console.error('Missing SUPPLIER_API_SECRET during Eprolo Webhook');
      return NextResponse.json({ error: 'Config missing' }, { status: 500 });
    }

    if (!md5sign) {
      return NextResponse.json({ error: 'Missing md5sign header' }, { status: 401 });
    }

    // Verify Signature: MD5(rawBody + sign_key)
    const computedHash = crypto.createHash('md5').update(rawBody + signKey).digest('hex');

    if (computedHash !== md5sign) {
      console.error('Invalid Eprolo Webhook Signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Process Payload (Eprolo sends an array of shipments)
    const payload: EproloWebhookPayload[] = JSON.parse(rawBody);

    for (const shipment of payload) {
      console.log(`[Eprolo Webhook] Received tracking for Order ID: ${shipment.order_id}`);
      console.log(`Carrier: ${shipment.tracking_company}`);
      console.log(`Tracking URL: ${shipment.tracking_url}`);

      // TODO: Update your internal database's order status to 'shipped'
      // TODO: Trigger WhatsApp Automator notification for tracking_url
      // Example: await updateOrderStatus(shipment.order_id, 'shipped', shipment.tracking_url);
    }

    return NextResponse.json({ code: 0, msg: "success" });

  } catch (error) {
    console.error('Eprolo Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
