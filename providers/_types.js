// Type catalog for the provider plugin contract.
//
// This file is documentation-only — pure JSDoc @typedef annotations. The
// project is plain ESM JavaScript with no build step; provider authors can
// reference these types via `/** @typedef {import('./_types.js').Provider} Provider */`
// at the top of a `// @ts-check`-enabled file to get IDE hints. The runtime
// contract is enforced by scan.mjs (id presence, fetch is a function, fetch
// returns an array), not by these annotations.
//
// Files prefixed with _ are never loaded as providers by scan.mjs.

/**
 * Normalized job posting.
 *
 * @typedef {object} Job
 * @property {string} title       Required, non-empty after trim.
 * @property {string} url         Required, absolute URL.
 * @property {string} job_url     Required, absolute URL used by the queue.
 * @property {string} company     Company name.
 * @property {string} location    May be empty.
 * @property {string} description May be empty.
 * @property {string} ats         greenhouse, lever, or ashby.
 * @property {string} job_id      Provider job id, when available.
 * @property {string} posted_at   ISO date from the provider, when available.
 */

/**
 * A single company entry from `config/companies.yml`.
 *
 * Provider-specific fields are opaque to scan.mjs and validated by the
 * provider itself. Examples in current providers: `api`, `slug`, `careers_url`.
 * Providers read these directly off the entry object — no schema enforcement
 * at the framework level.
 *
 * @typedef {object} PortalEntry
 * @property {string}             name             User-facing label; appears in logs and placeholders.
 * @property {boolean}            [enabled]        Default: true.
 * @property {string}             [careers_url]    Public listing URL; consumed by detect().
 * @property {string}             [ats]            Explicit provider id.
 * @property {string}             [provider]       Alias for ats.
 * @property {string}             [slug]           ATS board slug.
 * @property {('http')}           [transport]      Default: 'http'. Reserved for future transports.
 */

/**
 * Returned by `detect()` when a provider claims an entry. `url` is
 * informational (used in logs); routing only checks for a non-null return.
 *
 * @typedef {object} DetectHit
 * @property {string} url
 */

/**
 * Options forwarded to the underlying `fetch` call.
 *
 * @typedef {object} FetchOptions
 * @property {number}                [timeoutMs]
 * @property {Object<string,string>} [headers]
 * @property {string}                [method]
 * @property {(string|null)}         [body]
 */

/**
 * What scan.mjs hands to provider.fetch(). For Phase A only `transport: 'http'`
 * is implemented; the shape reserves room for future transports without
 * breaking the contract.
 *
 * @typedef {object} Context
 * @property {('http')} transport
 * @property {(url: string, opts?: FetchOptions) => Promise<string>}  fetchText
 * @property {(url: string, opts?: FetchOptions) => Promise<unknown>} fetchJson
 */

/**
 * The provider contract — the default export of every providers/*.mjs file
 * (excluding _-prefixed shared helpers).
 *
 * @typedef {object} Provider
 * @property {string} id                                                       Unique across all loaded providers.
 * @property {((entry: PortalEntry) => (DetectHit | null))} [detect]           Optional auto-detection.
 * @property {(entry: PortalEntry, ctx: Context) => Promise<Job[]>} fetch      Required.
 */

export {};
