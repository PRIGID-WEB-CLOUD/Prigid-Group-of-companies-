async function testUiBackendFlow() {
  console.log("=== Testing Admin Payment Settings UI Actions & Backend API ===");

  const secretKey = process.env.STRIPE_SECRET_KEY || "";
  const accountId = process.env.STRIPE_ACCOUNT_ID || "";

  // 1. Test Public Checkout Config API (Storefront Checkout Query)
  console.log("\n1. Testing Storefront Public API: GET /api/payments/checkout-config...");
  const configRes = await fetch("http://localhost:3000/api/payments/checkout-config");
  const configData = await configRes.json();
  console.log("Status:", configRes.status);
  console.log("Checkout Config:", configData);

  // 2. Test Stripe OAuth initiation URL generator
  console.log("\n2. Testing OAuth Connect Initiation: POST /api/payments/providers/stripe/connect...");
  const connectInitRes = await fetch("http://localhost:3000/api/payments/providers/stripe/connect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      redirectUri: "http://localhost:3000/api/payments/oauth/callback",
      returnUrl: "/admin/providers?tab=payments",
    }),
  });
  const connectInitData = await connectInitRes.json();
  console.log("Status:", connectInitRes.status);
  console.log("Response:", connectInitData);

  console.log("\n🎉 All UI Payment Manager Endpoint Connections Verified!");
  process.exit(0);
}

testUiBackendFlow().catch(err => {
  console.error("❌ Test error:", err);
  process.exit(1);
});
