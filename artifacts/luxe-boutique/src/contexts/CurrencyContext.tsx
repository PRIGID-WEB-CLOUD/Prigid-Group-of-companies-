import { createContext, useContext, useEffect, useState } from "react";

export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
  flag: string;
}

export const SUPPORTED_CURRENCIES: CurrencyInfo[] = [
  { code: "USD", symbol: "$", name: "US Dollar", flag: "🇺🇸" },
  { code: "GHS", symbol: "GH₵", name: "Ghana Cedi", flag: "🇬🇭" },
  { code: "NGN", symbol: "₦", name: "Nigerian Naira", flag: "🇳🇬" },
  { code: "EUR", symbol: "€", name: "Euro", flag: "🇪🇺" },
  { code: "GBP", symbol: "£", name: "British Pound", flag: "🇬🇧" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar", flag: "🇨🇦" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar", flag: "🇦🇺" },
  { code: "ZAR", symbol: "R", name: "South African Rand", flag: "🇿🇦" },
  { code: "KES", symbol: "KSh", name: "Kenyan Shilling", flag: "🇰🇪" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", flag: "🇯🇵" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan", flag: "🇨🇳" },
  { code: "CHF", symbol: "CHF", name: "Swiss Franc", flag: "🇨🇭" },
];

const SYMBOL_MAP: Record<string, string> = {
  USD: "$", GHS: "GH₵", NGN: "₦", EUR: "€", GBP: "£", JPY: "¥",
  AUD: "A$", CAD: "C$", CHF: "CHF", CNY: "¥", ZAR: "R", KES: "KSh",
};

type CurrencyContextType = {
  currencyCode: string;
  exchangeRate: number;
  symbol: string;
  formatPrice: (priceInUSD: number) => string;
  setCurrency: (code: string) => void;
  loading: boolean;
  currencies: CurrencyInfo[];
};

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [exchangeRate, setExchangeRate] = useState(1);
  const [symbol, setSymbol] = useState("$");
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [ratesMap, setRatesMap] = useState<Record<string, number>>({});

  useEffect(() => {
    setTimeout(() => setMounted(true), 0);

    async function initializeCurrency() {
      try {
        // Fetch fresh exchange rates table
        let liveRates: Record<string, number> = {
          USD: 1.0, GHS: 15.5, NGN: 1500, EUR: 0.92, GBP: 0.78,
          CAD: 1.36, AUD: 1.52, ZAR: 18.5, KES: 130, JPY: 155, CNY: 7.25, CHF: 0.88,
        };

        try {
          const ratesRes = await fetch("https://open.er-api.com/v6/latest/USD");
          if (ratesRes.ok) {
            const ratesData = await ratesRes.json();
            if (ratesData?.rates) {
              liveRates = { ...liveRates, ...ratesData.rates };
            }
          }
        } catch {
          // Use fallback rates
        }

        setRatesMap(liveRates);

        // Check if user has explicit saved preference
        const savedCurrency = localStorage.getItem("luxe_selected_currency");
        if (savedCurrency && liveRates[savedCurrency]) {
          applyCurrency(savedCurrency, liveRates);
          return;
        }

        // Auto-detect based on IP location
        try {
          const locationRes = await fetch("https://ipapi.co/json/");
          const locationData = await locationRes.json();
          const userCurrency = (locationData.currency || "USD").toUpperCase();

          if (userCurrency !== "USD" && liveRates[userCurrency]) {
            applyCurrency(userCurrency, liveRates);
            return;
          }
        } catch {
          // Default to USD
        }

        applyCurrency("USD", liveRates);
      } finally {
        setLoading(false);
      }
    }

    initializeCurrency();
  }, []);

  const applyCurrency = (targetCode: string, rates: Record<string, number>) => {
    const code = targetCode.toUpperCase();
    const rate = rates[code] || 1;
    const curSymbol = SYMBOL_MAP[code] || `${code} `;
    setCurrencyCode(code);
    setSymbol(curSymbol);
    setExchangeRate(rate);
  };

  const setCurrency = (targetCode: string) => {
    const code = targetCode.toUpperCase();
    localStorage.setItem("luxe_selected_currency", code);
    applyCurrency(code, ratesMap);
  };

  const formatPrice = (priceInUSD: number) => {
    const converted = priceInUSD * exchangeRate;
    if (!mounted) return `$${priceInUSD.toFixed(2)}`;
    try {
      const locale = typeof window !== "undefined" ? navigator.language : "en-US";
      return new Intl.NumberFormat(locale, { style: "currency", currency: currencyCode }).format(converted);
    } catch {
      return `${symbol}${converted.toFixed(2)}`;
    }
  };

  return (
    <CurrencyContext.Provider value={{
      currencyCode,
      exchangeRate,
      symbol,
      formatPrice,
      setCurrency,
      loading,
      currencies: SUPPORTED_CURRENCIES
    }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error("useCurrency must be used within a CurrencyProvider");
  return context;
}

