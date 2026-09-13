import { createContext, useContext, useEffect, useState } from "react";

type CurrencyContextType = {
  currencyCode: string;
  exchangeRate: number;
  symbol: string;
  formatPrice: (priceInUSD: number) => string;
  loading: boolean;
};

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [exchangeRate, setExchangeRate] = useState(1);
  const [symbol, setSymbol] = useState("$");
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTimeout(() => setMounted(true), 0);
    async function determineCurrency() {
      try {
        const locationRes = await fetch("https://ipapi.co/json/");
        const locationData = await locationRes.json();
        const userCurrency = locationData.currency || "USD";
        const symbolMap: Record<string, string> = {
          USD: "$", EUR: "€", GBP: "£", JPY: "¥", AUD: "A$",
          CAD: "C$", CHF: "CHF", CNY: "¥", SEK: "kr", NZD: "NZ$",
        };
        const curSymbol = symbolMap[userCurrency] || userCurrency + " ";
        if (userCurrency !== "USD") {
          const ratesRes = await fetch("https://open.er-api.com/v6/latest/USD");
          const ratesData = await ratesRes.json();
          const rate = ratesData.rates[userCurrency];
          if (rate) {
            setCurrencyCode(userCurrency);
            setSymbol(curSymbol);
            setExchangeRate(rate);
          }
        }
      } catch {
        // silently fallback to USD
      } finally {
        setLoading(false);
      }
    }
    determineCurrency();
  }, []);

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
    <CurrencyContext.Provider value={{ currencyCode, exchangeRate, symbol, formatPrice, loading }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error("useCurrency must be used within a CurrencyProvider");
  return context;
}
