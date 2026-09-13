async function testStripeConnect() {
  const secretKey = process.env.STRIPE_SECRET_KEY || "";
  const accountId = process.env.STRIPE_ACCOUNT_ID || "";

  if (!secretKey) {
    console.error("❌ STRIPE_SECRET_KEY environment variable is required.");
    process.exit(1);
  }

  console.log("=== Stripe Connect Direct API Test ===");
  console.log("Secret Key:", secretKey.substring(0, 16) + "...");
  console.log("Connected Account ID:", accountId);

  // 1. Account details verification
  console.log("\n1. Fetching connected account details from Stripe API...");
  const accountRes = await fetch(`https://api.stripe.com/v1/accounts/${accountId}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const account = await accountRes.json();

  if (!accountRes.ok) {
    console.error("❌ Stripe API error:", account);
    process.exit(1);
  }

  console.log("✅ Stripe Account Verified!");
  console.log("  - Account ID:", account.id);
  console.log("  - Display Name:", account.settings?.dashboard?.display_name || account.business_profile?.name || "Test Connected Account");
  console.log("  - Country:", account.country);
  console.log("  - Charges Enabled:", account.charges_enabled);
  console.log("  - Payouts Enabled:", account.payouts_enabled);

  // 2. Checkout Session creation
  console.log("\n2. Initializing Stripe Checkout session on behalf of connected account...");
  const sessionParams = new URLSearchParams({
    mode: "payment",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": "25000",
    "line_items[0][price_data][product_data][name]": "Luxe Atelier Silk Evening Dress",
    "line_items[0][quantity]": "1",
    success_url: "https://localhost:3000/order-confirmation?session_id={CHECKOUT_SESSION_ID}",
    cancel_url: "https://localhost:3000/cart",
    customer_email: "vip.client@luxeboutique.com",
    client_reference_id: "ORD-TEST-STRIPE-CONNECT-001",
  });

  const sessionRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Stripe-Account": accountId,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: sessionParams.toString(),
  });

  const sessionData = await sessionRes.json();
  if (!sessionRes.ok) {
    console.error("❌ Checkout session creation failed:", sessionData);
    process.exit(1);
  }

  console.log("✅ Checkout Session Created Successfully!");
  console.log("  - Session ID:", sessionData.id);
  console.log("  - Hosted Checkout URL:", sessionData.url);
  console.log("\n🎉 All Stripe Connect tests passed successfully!");
  process.exit(0);
}

testStripeConnect().catch(err => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
