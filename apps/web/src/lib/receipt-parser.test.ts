import { describe, it, expect } from 'vitest';
import { parseReceiptText } from './receipt-parser';

describe('parseReceiptText', () => {
  describe('amount parsing', () => {
    it('parses German comma decimal amount', () => {
      const result = parseReceiptText('Summe 12,34');
      expect(result.amount).toBe('12.34');
    });

    it('parses amount with thousands separator dot', () => {
      const result = parseReceiptText('Gesamt 1.234,56');
      expect(result.amount).toBe('1234.56');
    });

    it('prefers keyword line over larger non-keyword amount', () => {
      const text = 'Artikel 99,99\nSumme 12,34';
      const result = parseReceiptText(text);
      expect(result.amount).toBe('12.34');
    });

    it('falls back to largest amount when no keyword line matches', () => {
      const text = 'Artikel A 5,00\nArtikel B 12,34\nArtikel C 3,50';
      const result = parseReceiptText(text);
      expect(result.amount).toBe('12.34');
    });

    it('ignores MwSt lines when picking the amount', () => {
      const text = 'MwSt 20% 99,99\nSumme 12,34';
      const result = parseReceiptText(text);
      expect(result.amount).toBe('12.34');
    });

    it('ignores Steuer lines entirely, even without a competing keyword line', () => {
      const text = 'Steuer 50,00';
      const result = parseReceiptText(text);
      expect(result.amount).toBeUndefined();
    });

    it('returns undefined amount when text has no numbers at all', () => {
      const result = parseReceiptText('Vielen Dank für Ihren Einkauf');
      expect(result.amount).toBeUndefined();
    });

    it('recognizes "zu zahlen" and "kartenzahlung" as amount keywords', () => {
      const text = 'Artikel 5,00\nKartenzahlung 5,00';
      const result = parseReceiptText(text);
      expect(result.amount).toBe('5.00');
    });

    it('picks the first keyword amount when multiple keyword lines exist', () => {
      const text = 'Betrag 7,50\nGesamt 8,00';
      const result = parseReceiptText(text);
      expect(result.amount).toBe('7.50');
    });
  });

  describe('date parsing', () => {
    it('parses a full four-digit-year date', () => {
      const result = parseReceiptText('Datum: 17.07.2026');
      expect(result.date).toBe('2026-07-17');
    });

    it('parses a two-digit-year date', () => {
      const result = parseReceiptText('17.07.26');
      expect(result.date).toBe('2026-07-17');
    });

    it('supports slash-separated dates', () => {
      const result = parseReceiptText('17/07/2026');
      expect(result.date).toBe('2026-07-17');
    });

    it('returns undefined date when no date is present', () => {
      const result = parseReceiptText('Supermarkt GmbH\nSumme 12,34');
      expect(result.date).toBeUndefined();
    });

    it('rejects an implausible date with month out of range', () => {
      const result = parseReceiptText('17.13.2026');
      expect(result.date).toBeUndefined();
    });

    it('rejects an implausible date with day out of range', () => {
      const result = parseReceiptText('32.01.2026');
      expect(result.date).toBeUndefined();
    });

    it('rejects a date too far in the future', () => {
      const result = parseReceiptText('01.01.2099');
      expect(result.date).toBeUndefined();
    });
  });

  describe('merchant name parsing', () => {
    it('picks the first plausible non-numeric line as description', () => {
      const text = 'Supermarkt XY\nMusterstraße 1\nSumme 12,34';
      const result = parseReceiptText(text);
      expect(result.description).toBe('Supermarkt XY');
    });

    it('skips address lines when looking for the merchant name', () => {
      const text = '12345\nMusterstraße 1\nBäckerei Huber\nSumme 5,00';
      const result = parseReceiptText(text);
      expect(result.description).toBe('Bäckerei Huber');
    });

    it('only looks within the first three lines for a merchant name', () => {
      const text = 'Tel: 0123456\nUID: ATU12345678\nwww.example.com\nBäckerei Huber\nSumme 5,00';
      const result = parseReceiptText(text);
      expect(result.description).toBeUndefined();
    });

    it('returns undefined description when nothing plausible is found', () => {
      const text = 'Tel: 0123456\nUID: ATU12345678\nwww.example.com';
      const result = parseReceiptText(text);
      expect(result.description).toBeUndefined();
    });

    it('truncates a very long merchant line to 40 characters', () => {
      const longName = 'A'.repeat(80);
      const result = parseReceiptText(longName);
      expect(result.description).toHaveLength(40);
    });
  });

  describe('robustness', () => {
    it('returns an empty object for an empty string', () => {
      expect(parseReceiptText('')).toEqual({});
    });

    it('returns an empty object for whitespace-only input', () => {
      expect(parseReceiptText('   \n\n   ')).toEqual({});
    });

    it('does not throw for null input and returns an empty object', () => {
      expect(() => parseReceiptText(null as unknown as string)).not.toThrow();
      expect(parseReceiptText(null as unknown as string)).toEqual({});
    });

    it('does not throw for undefined input and returns an empty object', () => {
      expect(() => parseReceiptText(undefined as unknown as string)).not.toThrow();
      expect(parseReceiptText(undefined as unknown as string)).toEqual({});
    });

    it('sets at most a description for text without any numbers', () => {
      const result = parseReceiptText('Nur Text ohne Zahlen und Zeilenumbrüche');
      expect(result.amount).toBeUndefined();
      expect(result.date).toBeUndefined();
      expect(result.description).toBeDefined();
    });

    it('does not throw on text containing special characters', () => {
      const text = '★★★ Supermarkt ★★★\n!@#$%^&*()\nSumme 12,34';
      expect(() => parseReceiptText(text)).not.toThrow();
      const result = parseReceiptText(text);
      expect(result.amount).toBe('12.34');
    });

    it('does not throw on a very long input text', () => {
      const longText = Array(5000).fill('Artikel 1,00').join('\n') + '\nSumme 99,99';
      expect(() => parseReceiptText(longText)).not.toThrow();
      const result = parseReceiptText(longText);
      expect(result.amount).toBe('99.99');
    });
  });
});
