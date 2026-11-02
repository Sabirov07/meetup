/**
 * Every string in the interface lives as an `[English, Russian]` pair, in one
 * place, next to its translation.
 *
 * Keeping the two languages in the same literal is deliberate: a dictionary per
 * language drifts the moment someone adds a key to one and forgets the other,
 * and nothing about the type system notices. Here a pair is the unit, so a
 * missing translation is a type error at the point of writing.
 *
 * ## Plurals
 *
 * Russian has three plural forms where English has two. A countable string is
 * therefore written as a family of four keys — `.one`, `.few`, `.many`,
 * `.other` — and read back with `t("some.key", { count: n })`, which picks the
 * form `Intl.PluralRules` selects for the active language. English never
 * selects `few` or `many`, so those entries repeat the `other` wording on the
 * English side; that redundancy is the price of catching a missing Russian form
 * at compile time, and it is worth paying.
 *
 * ## Interpolation
 *
 * `{name}` placeholders are filled from the `vars` passed to `t`. Numbers are
 * run through `Intl.NumberFormat` for the active language.
 */

export type Entry = readonly [en: string, ru: string];

export type Entries = Readonly<Record<string, Entry>>;
