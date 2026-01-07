/**
 * Honorific Prefixes and Suffixes
 *
 * Used by the Indian Name Parser to strip titles from names.
 */

/**
 * Common honorific prefixes in Indian names
 * All entries should be lowercase, without periods
 */
export const HONORIFIC_PREFIXES = new Set([
    // English titles
    'mr',
    'mrs',
    'ms',
    'miss',
    'dr',
    'prof',
    'professor',
    'master',
    'rev',
    'reverend',

    // Hindi/Sanskrit titles
    'shri',
    'shree',
    'sri',
    'sree',
    'shrimati',
    'shreemati',
    'srimati',
    'smt',
    'kumari',
    'kumar', // As honorific only (Shri Kumar...)
    'pandit',
    'pt',
    'swami',
    'acharya',
    'guru',
    'sant',
    'baba',
    'mata',
    'devi',

    // Tamil titles
    'thiru',
    'thirumathi',
    'selvi',
    'selvan',

    // Professional titles
    'ca', // Chartered Accountant
    'cs', // Company Secretary
    'adv', // Advocate
    'advocate',
    'er', // Engineer
    'ar', // Architect
    'cma', // Cost & Management Accountant

    // Military/Police
    'col',
    'colonel',
    'lt',
    'lieutenant',
    'capt',
    'captain',
    'maj',
    'major',
    'gen',
    'general',
    'brig',
    'brigadier',
    'comdt',
    'commandant',
    'insp',
    'inspector',
    'si', // Sub-Inspector
    'asi', // Assistant Sub-Inspector

    // Judicial
    'justice',
    'hon',
    'honorable',
    'honourable',
]);

/**
 * Common honorific suffixes in Indian names
 * All entries should be lowercase, without periods
 */
export const HONORIFIC_SUFFIXES = new Set([
    // Academic
    'phd',
    'dphil',
    'md',
    'mbbs',
    'bds',
    'mba',
    'mca',
    'btech',
    'mtech',
    'be',
    'me',
    'bsc',
    'msc',
    'ba',
    'ma',
    'llb',
    'llm',

    // Professional certifications
    'fca', // Fellow Chartered Accountant
    'aca', // Associate Chartered Accountant
    'fcs', // Fellow Company Secretary
    'acs', // Associate Company Secretary
    'cfa', // Chartered Financial Analyst
    'cpa', // Certified Public Accountant

    // Civil services
    'ias', // Indian Administrative Service
    'ips', // Indian Police Service
    'ifs', // Indian Foreign Service
    'irs', // Indian Revenue Service

    // Generational
    'jr',
    'junior',
    'sr',
    'senior',
    'ii',
    'iii',
    'iv',

    // Religious
    'ji', // Respectful suffix
    'sahib',
    'saheb',
]);
