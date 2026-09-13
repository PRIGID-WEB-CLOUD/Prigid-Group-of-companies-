/**
 * Cart Diagnostic Utility
 * Captures, formats, and logs full payload validation steps and cart state
 * when adding items to cart.
 */

export interface CartDiagnosticPayload {
  productId: string;
  quantity: number | string;
  timestamp: string;
  userContext: {
    authenticated: boolean;
    userId?: string;
  };
}

export interface CartDiagnosticStep {
  step: string;
  passed: boolean;
  details: string;
}

export async function logCartDiagnostic(
  productId: string,
  quantity: number | string,
  user?: { id?: string } | null,
  response?: Response,
  responseData?: any
) {
  const timestamp = new Date().toISOString();
  const payload: CartDiagnosticPayload = {
    productId,
    quantity,
    timestamp,
    userContext: {
      authenticated: !!user,
      userId: user?.id,
    },
  };

  const steps: CartDiagnosticStep[] = [];

  // Step 1: Payload validation
  const isValidProductId = typeof productId === "string" && productId.trim().length > 0;
  const numQty = typeof quantity === "number" ? quantity : parseInt(String(quantity), 10);
  const isValidQuantity = !isNaN(numQty) && numQty >= 1 && numQty <= 100;

  steps.push({
    step: "1. Client Payload Structure",
    passed: isValidProductId && isValidQuantity,
    details: `productId: "${productId}" (${isValidProductId ? "VALID" : "INVALID"}), quantity: ${quantity} (${isValidQuantity ? "VALID" : "INVALID"})`,
  });

  // Step 2: Session & Cookie check
  const hasCookies = typeof document !== "undefined" && document.cookie.length > 0;
  steps.push({
    step: "2. Browser Session & Cookies",
    passed: hasCookies,
    details: `Cookies active: ${hasCookies ? "YES" : "NO"} (${document.cookie ? document.cookie.split(";").length + " cookies set" : "No cookies found"})`,
  });

  // Step 3: Server Response status
  if (response) {
    const isSuccess = response.ok;
    steps.push({
      step: "3. Server Route Execution",
      passed: isSuccess,
      details: `HTTP Status ${response.status} (${response.statusText || (isSuccess ? "OK" : "REJECTED")})`,
    });

    if (!isSuccess && responseData?.error) {
      steps.push({
        step: "4. Rejection Cause",
        passed: false,
        details: `Reason: "${responseData.error}"`,
      });
    } else if (isSuccess) {
      const itemCount = responseData?.items?.length ?? 0;
      steps.push({
        step: "4. Cart State Verification",
        passed: true,
        details: `Cart updated successfully. Total items in cart: ${itemCount}`,
      });
    }
  }

  // Visual Console Logging
  console.groupCollapsed(`🛒 [Cart Diagnostic] Add To Cart - ${isValidProductId && response?.ok ? "SUCCESS" : "REJECTED"} (${timestamp})`);
  console.log("📦 Request Payload:", payload);
  console.table(steps);
  if (responseData) {
    console.log("📄 Response Data:", responseData);
  }

  // Attempt to fetch server diagnostic state for deeper investigation
  try {
    const debugRes = await fetch("/api/cart/debug");
    if (debugRes.ok) {
      const debugData = await debugRes.json();
      console.log("🔍 Server Cart Diagnostic State:", debugData);
    }
  } catch (e) {
    console.warn("Could not fetch server cart debug info:", e);
  }

  console.groupEnd();

  return { payload, steps, responseData };
}
