import { strings } from "./strings";
import { bcp47, type Locale } from "./locale";

/** The column of the `[en, ru]` pairs each language reads. */
const COLUMN: Record<Locale, 0 | 1> = { en: 0, ru: 1 };

export type MessageId = keyof typeof strings;

export type Dictionary = Record<MessageId, string>;

/**
 * A key accepted by `t`: either a message id, or the base of a plural family
 * (`"tasks.open"` for `"tasks.open.one" | ".few" | ".many" | ".other"`).
 */
type PluralBase<K> = K extends `${infer Base}.other` ? Base : never;
export type TranslationKey = MessageId | PluralBase<MessageId>;

export type Vars = Record<string, string | number>;

const dictionaries = new Map<Locale, Dictionary>();

/** Flattens the pairs into one language's strings. Built once per language. */
export function getDictionary(locale: Locale): Dictionary {
  const cached = dictionaries.get(locale);
  if (cached) return cached;

  const column = COLUMN[locale];
  const dictionary = Object.fromEntries(
    Object.entries(strings).map(([key, pair]) => [key, pair[column]]),
  ) as Dictionary;

  dictionaries.set(locale, dictionary);
  return dictionary;
}

const pluralRules = new Map<Locale, Intl.PluralRules>();

function rulesFor(locale: Locale): Intl.PluralRules {
  let rules = pluralRules.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(bcp47[locale]);
    pluralRules.set(locale, rules);
  }
  return rules;
}

const numberFormats = new Map<Locale, Intl.NumberFormat>();

export function formatNumber(value: number, locale: Locale): string {
  let format = numberFormats.get(locale);
  if (!format) {
    format = new Intl.NumberFormat(bcp47[locale]);
    numberFormats.set(locale, format);
  }
  return format.format(value);
}

function fill(template: string, locale: Locale, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    if (value === undefined) return match;
    return typeof value === "number" ? formatNumber(value, locale) : value;
  });
}

/**
 * Resolves a key against a dictionary.
 *
 * A key that is missing falls back to the key itself rather than rendering
 * `undefined` — a visible `tasks.title` in the UI is a bug report, a blank
 * space is a mystery.
 */
export function translate(
  dictionary: Dictionary,
  locale: Locale,
  key: TranslationKey,
  vars?: Vars,
): string {
  const direct = dictionary[key as MessageId];
  if (direct !== undefined) return fill(direct, locale, vars);

  const count = vars?.count;
  const form =
    typeof count === "number" ? rulesFor(locale).select(count) : "other";

  const template =
    dictionary[`${key}.${form}` as MessageId] ??
    dictionary[`${key}.other` as MessageId] ??
    dictionary[`${key}.many` as MessageId] ??
    dictionary[`${key}.one` as MessageId];

  return template === undefined ? key : fill(template, locale, vars);
}

export type Translate = (key: TranslationKey, vars?: Vars) => string;
