/**
 * Real-time Exchange Rate Service
 * Fetches and caches live exchange rates for international currencies against USD base.
 */

interface RatesCache {
  base: string;
  rates: Record<string, number>;
  timestamp: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache
let cachedRates: RatesCache | null = null;

// Built-in fallback exchange rates for resilience against upstream API timeouts
const FALLBACK_RATES: Record<string, number> = {
  USD: 1.0,
  GHS: 15.5,   // Ghanaian Cedi (~15.5 GHS per 1 USD)
  NGN: 1500.0, // Nigerian Naira (~1500 NGN per 1 USD)
  KES: 130.0,  // Kenyan Shilling (~130 KES per 1 USD)
  ZAR: 18.5,   // South African Rand (~18.5 ZAR per 1 USD)
  EUR: 0.92,   // Euro
  GBP: 0.78,   // British Pound
  CAD: 1.36,   // Canadian Dollar
  AUD: 1.52,   // Australian Dollar
  JPY: 155.0,  // Japanese Yen
  CNY: 7.25,   // Chinese Yuan
  INR: 84.0,   // Indian Rupee
  BRL: 5.60,   // Brazilian Real
  EGP: 48.5,   // Egyptian Pound
};

/**
 * Fetch fresh exchange rates against USD
 */
export async function fetchExchangeRates(): Promise<Record<string, number>> {
  const now = Date.now();
  if (cachedRates && now - cachedRates.timestamp < CACHE_TTL_MS) {
    return cachedRates.rates;
  }

  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = (await res.json()) as { rates?: Record<string, number> };
      if (data && data.rates && typeof data.rates === "object") {
        cachedRates = {
          base: "USD",
          rates: { ...FALLBACK_RATES, ...data.rates },
          timestamp: now,
        };
        return cachedRates.rates;
      }
    }
  } catch (err) {
    console.warn("[ExchangeRateService] Live rate fetch error, using resilient fallback rates:", err);
  }

  return cachedRates?.rates || FALLBACK_RATES;
}

/**
 * Get the current exchange rate for a target currency against USD base
 */
export async function getExchangeRate(targetCurrency: string, baseCurrency = "USD"): Promise<number> {
  const target = targetCurrency.toUpperCase();
  const base = baseCurrency.toUpperCase();

  if (target === base) return 1.0;

  const rates = await fetchExchangeRates();

  const targetRate = rates[target] || FALLBACK_RATES[target] || 1.0;
  const baseRate = rates[base] || FALLBACK_RATES[base] || 1.0;

  return targetRate / baseRate;
}

/**
 * Convert a base USD amount (in minor units / cents) to a target currency (in minor units / pesewas / kobo / etc.)
 */
export async function convertFromUSD(
  amountInUSDCents: number,
  targetCurrency: string
): Promise<{
  rate: number;
  convertedAmount: number; // in minor units
  targetCurrency: string;
}> {
  const target = targetCurrency.toUpperCase();
  if (target === "USD") {
    return {
      rate: 1.0,
      convertedAmount: Math.round(amountInUSDCents),
      targetCurrency: "USD",
    };
  }

  const rate = await getExchangeRate(target, "USD");
  // Minor units: e.g. $18.50 (1850 cents) * 15.5 = GHS 286.75 (28675 pesewas)
  const convertedAmount = Math.max(100, Math.round(amountInUSDCents * rate));

  return {
    rate,
    convertedAmount,
    targetCurrency: target,
  };
}
