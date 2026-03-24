/**
 * Display all trip/booking prices as Pakistani Rupees (PKR).
 * Stored values in the API/DB are treated as PKR amounts.
 */

export function formatPkr(
  amount: number | string | undefined | null,
  options?: { maximumFractionDigits?: number; minimumFractionDigits?: number }
): string {
  if (amount === undefined || amount === null || amount === "") {
    return new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: "PKR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(0);
  }
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (Number.isNaN(n)) {
    return new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: "PKR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(0);
  }
  const min = options?.minimumFractionDigits ?? 0;
  const max = options?.maximumFractionDigits ?? min;
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  }).format(n);
}

export const PRICE_INPUT_PREFIX_LABEL = "Rs.";
