export interface ParsedReceipt {
  amount?: string;
  date?: string;
  description?: string;
}

const AMOUNT_REGEX = /\d{1,3}(?:[.\s]?\d{3})*[.,]\d{2}\b/g;
const AMOUNT_KEYWORD_REGEX = /summe|gesamt|total|zu zahlen|betrag|kartenzahlung/i;
const TAX_KEYWORD_REGEX = /mwst|ust|steuer/i;
const DATE_REGEX = /\b(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})\b/;
const MERCHANT_EXCLUDE_REGEX = /str\.|straße|tel|uid|iban|www|@|ust-idnr/i;
const DIGIT_RUN_REGEX = /\d{4,}/;

function normalizeAmount(raw: string): string {
  const lastComma = raw.lastIndexOf(',');
  const lastDot = raw.lastIndexOf('.');
  const decimalIndex = Math.max(lastComma, lastDot);
  const integerPart = raw.slice(0, decimalIndex).replace(/[.,\s]/g, '');
  const decimalPart = raw.slice(decimalIndex + 1);
  return `${parseInt(integerPart, 10)}.${decimalPart}`;
}

function parseAmount(lines: string[]): string | undefined {
  let keywordAmount: string | undefined;
  let fallbackAmount: number | undefined;
  let fallbackRaw: string | undefined;

  for (const line of lines) {
    if (TAX_KEYWORD_REGEX.test(line)) continue;

    const matches = line.match(AMOUNT_REGEX);
    if (!matches) continue;

    const isKeywordLine = AMOUNT_KEYWORD_REGEX.test(line);

    for (const match of matches) {
      const normalized = normalizeAmount(match);
      const value = parseFloat(normalized);
      if (Number.isNaN(value)) continue;

      if (isKeywordLine && keywordAmount === undefined) {
        keywordAmount = normalized;
      }

      if (fallbackAmount === undefined || value > fallbackAmount) {
        fallbackAmount = value;
        fallbackRaw = normalized;
      }
    }
  }

  return keywordAmount ?? fallbackRaw;
}

function parseDate(lines: string[]): string | undefined {
  const currentYear = new Date().getFullYear();

  for (const line of lines) {
    const match = line.match(DATE_REGEX);
    if (!match) continue;

    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    let year = parseInt(match[3], 10);
    if (year < 100) year += 2000;

    if (month < 1 || month > 12) continue;
    if (day < 1 || day > 31) continue;
    if (year < 2000 || year > currentYear + 1) continue;

    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  }

  return undefined;
}

function parseMerchant(lines: string[]): string | undefined {
  for (const line of lines.slice(0, 3)) {
    if (DIGIT_RUN_REGEX.test(line)) continue;
    if (MERCHANT_EXCLUDE_REGEX.test(line)) continue;
    return line.slice(0, 40);
  }
  return undefined;
}

export function parseReceiptText(text: string): ParsedReceipt {
  if (!text) return {};

  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) return {};

  return {
    amount: parseAmount(lines),
    date: parseDate(lines),
    description: parseMerchant(lines),
  };
}
