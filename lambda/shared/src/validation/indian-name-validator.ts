/**
 * Indian Name Validator
 *
 * Sophisticated validation for Indian names used in lead staging.
 * Since this system operates exclusively in India, names are validated
 * against common Indian naming patterns, structures, and conventions.
 *
 * Features:
 * - Common Indian first name database lookup
 * - Pattern recognition for various Indian naming conventions
 * - Honorific and suffix handling
 * - Character set validation (Latin + common transliterations)
 * - Structural validation (min/max tokens, length constraints)
 */

import {
    HONORIFIC_PREFIXES,
    HONORIFIC_SUFFIXES,
    COMMON_SURNAMES,
    POSITION_DEPENDENT_NAMES,
} from '../utils/name-parser-data.js';

// =============================================================================
// Types
// =============================================================================

export interface NameValidationResult {
    readonly valid: boolean;
    readonly confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    readonly normalizedName: string;
    readonly errors: readonly string[];
    readonly warnings: readonly string[];
    readonly metadata: NameMetadata;
}

export interface NameMetadata {
    readonly tokenCount: number;
    readonly hasHonorific: boolean;
    readonly hasSurname: boolean;
    readonly hasInitials: boolean;
    readonly detectedPattern: IndianNamePattern;
}

export type IndianNamePattern =
    | 'NORTH_INDIAN'      // Rahul Sharma, Amit Kumar Verma
    | 'SOUTH_INDIAN'      // R. Venkatesh, Anand K. Nair
    | 'BENGALI'           // Subhash Chandra Bose, Rabindranath Tagore
    | 'SIKH'              // Harpreet Singh, Gurpreet Kaur
    | 'MUSLIM'            // Mohammad Irfan Khan, Fatima Begum
    | 'CHRISTIAN'         // John Abraham, Mary Thomas
    | 'SINGLE_NAME'       // Rekha, Madhuri
    | 'INITIALS_HEAVY'    // S. K. Sharma, A.B.C. Reddy
    | 'UNKNOWN';

// =============================================================================
// Indian First Names Database (Common names - not exhaustive)
// =============================================================================

const COMMON_INDIAN_FIRST_NAMES = new Set([
    // Male - North Indian
    'aarav', 'aditya', 'akash', 'amit', 'anil', 'ankit', 'arjun', 'ashok', 'ayush',
    'bharat', 'bhushan',
    'chetan', 'chirag',
    'deepak', 'dev', 'dhruv', 'dinesh',
    'gaurav', 'gopal', 'govind',
    'harsh', 'hemant', 'hitesh',
    'ishaan',
    'jai', 'jayesh', 'jitendra',
    'karan', 'kartik', 'kiran', 'krishna', 'kunal',
    'lalit', 'lokesh',
    'madhav', 'mahesh', 'manoj', 'mayank', 'mohit', 'mukesh',
    'naman', 'naveen', 'nikhil', 'nitin',
    'om',
    'pankaj', 'pavan', 'pradeep', 'prakash', 'pramod', 'pranav', 'prashant', 'praveen',
    'rahul', 'raj', 'rajat', 'rajesh', 'rakesh', 'ramesh', 'ravi', 'rishabh', 'ritesh', 'rohit', 'roshan',
    'sachin', 'sahil', 'sanjay', 'sanjeev', 'saurabh', 'shashank', 'shivam', 'shubham', 'siddharth', 'sumit', 'sunil', 'suresh',
    'tanmay', 'tarun', 'tushar',
    'uday', 'utkarsh',
    'varun', 'vijay', 'vikas', 'vinay', 'vinod', 'vishal', 'vivek',
    'yash', 'yogesh',

    // Male - South Indian
    'aravind', 'ashwin', 'balaji', 'ganesh', 'hari', 'karthik', 'krishnamurthy', 'murali',
    'narayanan', 'prashanth', 'raghu', 'raghunath', 'ramakrishnan', 'raman', 'sathish', 'senthil',
    'shankar', 'sridhar', 'srikanth', 'srinivas', 'subramaniam', 'sundaram', 'venkat', 'venkatesh', 'vishnu',

    // Male - Bengali
    'abhijit', 'amitabh', 'anirban', 'arijit', 'arnab', 'debashis', 'dipankar', 'indrajit',
    'partha', 'prasenjit', 'prosenjit', 'rajdeep', 'ranajit', 'sandip', 'sanjit', 'soumitra', 'subhash', 'suman', 'tapan',

    // Male - Sikh
    'amarjit', 'amritpal', 'balwinder', 'daljit', 'gurpreet', 'hardeep', 'harjit', 'harpreet',
    'jagjit', 'jaspreet', 'kuldeep', 'manpreet', 'navjot', 'paramjit', 'ranjit', 'satinder', 'sukhwinder', 'tejinder',

    // Male - Muslim
    'aamir', 'abdul', 'ahmed', 'akbar', 'ali', 'arif', 'asif', 'aziz', 'faisal', 'farhan', 'imran',
    'irfan', 'javed', 'khalid', 'mohammad', 'mohammed', 'muhammed', 'nadeem', 'nasir', 'rashid',
    'rizwan', 'salim', 'salman', 'sameer', 'shakeel', 'sharif', 'tariq', 'wasim', 'zaheer', 'zubair',

    // Female - North Indian
    'aishwarya', 'akanksha', 'ananya', 'anjali', 'anushka', 'arpita', 'astha', 'bhavna', 'chandni',
    'deepa', 'deepika', 'divya', 'esha', 'garima', 'gayatri', 'geeta', 'isha', 'jaya', 'jyoti', 'kajal',
    'kavita', 'kavya', 'khushi', 'komal', 'kritika', 'lata', 'madhu', 'mamta', 'manisha', 'meena', 'megha',
    'monika', 'nandini', 'neha', 'nisha', 'pallavi', 'pooja', 'prachi', 'pragya', 'pratibha', 'preeti',
    'priya', 'priyanka', 'radha', 'renu', 'ritu', 'roma', 'sakshi', 'sangeeta', 'sapna', 'sarita', 'shikha',
    'shilpa', 'shraddha', 'shreya', 'shweta', 'simran', 'sneha', 'sonia', 'sunita', 'swati', 'tanvi', 'tanya',
    'usha', 'vandana', 'varsha', 'vidya', 'vineeta',

    // Female - South Indian
    'ahalya', 'anitha', 'anuradha', 'bhavani', 'chitra', 'geetha', 'hema', 'janaki', 'jyothi', 'kamala',
    'kalpana', 'lakshmi', 'lalitha', 'malini', 'meenakshi', 'padma', 'parvathi', 'radha', 'rajeshwari',
    'revathi', 'saroja', 'savitri', 'shanthi', 'sita', 'sumathi', 'sundari', 'usha', 'vani', 'vasanthi', 'vijaya',

    // Female - Bengali
    'aparna', 'bratati', 'durga', 'indrani', 'jayashree', 'kalyani', 'mitali', 'mousumi', 'paromita',
    'rupa', 'sharmila', 'shoma', 'soma', 'sumana', 'swapna', 'tanushree', 'tapasi',

    // Female - Sikh
    'amandeep', 'amanjot', 'balpreet', 'gurleen', 'harleen', 'jaspreet', 'jasleen', 'manpreet',
    'navjot', 'navpreet', 'prabhjot', 'rajveer', 'simran', 'sukhjit', 'sukhpreet',

    // Female - Muslim
    'aisha', 'amina', 'ayesha', 'bushra', 'fatima', 'firdaus', 'gulshan', 'hasina', 'nazia', 'nazreen',
    'noor', 'rehana', 'rukhsar', 'sabina', 'saira', 'samina', 'shabana', 'shaheen', 'shamim', 'yasmin', 'zarina', 'zeenat',
]);

// Additional components that appear in Indian names
const INDIAN_NAME_COMPONENTS = new Set([
    // Common middle name components
    'bahadur', 'bai', 'begum', 'ben', 'bhai', 'bibi', 'deen', 'devi', 'kaur', 'kumari', 'lal',
    'mal', 'mian', 'nath', 'prasad', 'ram', 'rani', 'sagar', 'wati',

    // Position-dependent names (can be first or middle)
    ...Array.from(POSITION_DEPENDENT_NAMES),
]);

// =============================================================================
// Validation Rules
// =============================================================================

const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 100;
const MIN_TOKENS = 1;
const MAX_TOKENS = 6;

// Valid characters for Indian names (Latin script + common diacritics)
const VALID_NAME_PATTERN = /^[A-Za-z\u00C0-\u024F\s.''-]+$/;

// Patterns that suggest non-Indian or invalid names
const SUSPICIOUS_PATTERNS = [
    /^[0-9]+$/,                          // All numbers
    /^[A-Z]{10,}$/,                      // All caps, very long
    /(.)\1{3,}/i,                        // Same character repeated 4+ times
    /^(test|demo|sample|dummy|fake)/i,  // Test data
    /^(admin|user|guest|root|system)/i, // System names
    /@|www\.|\.com|\.in/i,              // Contains URL/email parts
    /^[^aeiouAEIOU]{6,}$/,              // No vowels, 6+ chars (unpronounceable)
];

// =============================================================================
// Main Validation Function
// =============================================================================

/**
 * Validate an Indian name for lead staging.
 *
 * @param fullName - The full name to validate
 * @returns Validation result with confidence score and metadata
 */
export function validateIndianName(fullName: string): NameValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Stage 1: Basic input validation
    if (!fullName || typeof fullName !== 'string') {
        return createResult(false, 'LOW', '', ['Name is required'], [], {
            tokenCount: 0,
            hasHonorific: false,
            hasSurname: false,
            hasInitials: false,
            detectedPattern: 'UNKNOWN',
        });
    }

    // Normalize the name
    const normalized = normalizeName(fullName);

    if (!normalized) {
        return createResult(false, 'LOW', '', ['Name cannot be empty'], [], {
            tokenCount: 0,
            hasHonorific: false,
            hasSurname: false,
            hasInitials: false,
            detectedPattern: 'UNKNOWN',
        });
    }

    // Stage 2: Length validation
    if (normalized.length < MIN_NAME_LENGTH) {
        errors.push(`Name too short (minimum ${MIN_NAME_LENGTH} characters)`);
    }

    if (normalized.length > MAX_NAME_LENGTH) {
        errors.push(`Name too long (maximum ${MAX_NAME_LENGTH} characters)`);
    }

    // Stage 3: Character validation
    if (!VALID_NAME_PATTERN.test(normalized)) {
        errors.push('Name contains invalid characters');
    }

    // Stage 4: Suspicious pattern detection
    for (const pattern of SUSPICIOUS_PATTERNS) {
        if (pattern.test(normalized)) {
            errors.push('Name appears to be invalid or test data');
            break;
        }
    }

    // Stage 5: Token analysis
    const tokens = tokenizeName(normalized);
    const tokenCount = tokens.length;

    if (tokenCount < MIN_TOKENS) {
        errors.push('Name must contain at least one valid name part');
    }

    if (tokenCount > MAX_TOKENS) {
        warnings.push(`Name has many parts (${tokenCount}), verify accuracy`);
    }

    // Stage 6: Structural analysis
    const hasHonorific = checkHasHonorific(tokens);
    const hasSurname = checkHasSurname(tokens);
    const hasInitials = checkHasInitials(tokens);
    const meaningfulTokens = tokens.filter(t => !isInitial(t) && !isHonorific(t));

    // Stage 7: Indian name recognition
    const recognitionResult = recognizeIndianName(tokens);
    const detectedPattern = recognitionResult.pattern;
    let confidence = recognitionResult.confidence;

    // Must have at least one non-initial, non-honorific token
    if (meaningfulTokens.length === 0) {
        errors.push('Name must contain at least one actual name (not just initials or titles)');
    }

    // Check if we recognize any Indian name components
    const hasRecognizedName = meaningfulTokens.some(
        t => COMMON_INDIAN_FIRST_NAMES.has(t.toLowerCase()) ||
             COMMON_SURNAMES.has(t.toLowerCase()) ||
             INDIAN_NAME_COMPONENTS.has(t.toLowerCase())
    );

    if (!hasRecognizedName && meaningfulTokens.length > 0) {
        // Not a critical error, but reduce confidence
        warnings.push('Name pattern not commonly recognized as Indian');
        if (confidence === 'HIGH') confidence = 'MEDIUM';
    }

    // Stage 8: Single name handling
    if (tokenCount === 1 && !hasRecognizedName) {
        warnings.push('Single-word name - verify completeness');
        if (confidence === 'HIGH') confidence = 'MEDIUM';
    }

    // Determine final validity
    const valid = errors.length === 0;

    return createResult(valid, confidence, normalized, errors, warnings, {
        tokenCount,
        hasHonorific,
        hasSurname,
        hasInitials,
        detectedPattern,
    });
}

// =============================================================================
// Helper Functions
// =============================================================================

function createResult(
    valid: boolean,
    confidence: 'HIGH' | 'MEDIUM' | 'LOW',
    normalizedName: string,
    errors: string[],
    warnings: string[],
    metadata: NameMetadata
): NameValidationResult {
    return {
        valid,
        confidence,
        normalizedName,
        errors,
        warnings,
        metadata,
    };
}

function normalizeName(name: string): string {
    return name
        .normalize('NFC')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')  // Remove zero-width chars
        .replace(/\s+/g, ' ')                   // Normalize whitespace
        .trim();
}

function tokenizeName(name: string): string[] {
    return name
        .split(/[\s,]+/)
        .filter(Boolean)
        .map(t => t.replace(/^[.''-]+|[.''-]+$/g, '')); // Trim punctuation from ends
}

function isInitial(token: string): boolean {
    return /^[A-Za-z]\.?$/.test(token);
}

function isHonorific(token: string): boolean {
    const lower = token.toLowerCase().replace(/\./g, '');
    return HONORIFIC_PREFIXES.has(lower) || HONORIFIC_SUFFIXES.has(lower);
}

function checkHasHonorific(tokens: string[]): boolean {
    return tokens.some(isHonorific);
}

function checkHasSurname(tokens: string[]): boolean {
    return tokens.some(t => COMMON_SURNAMES.has(t.toLowerCase()));
}

function checkHasInitials(tokens: string[]): boolean {
    return tokens.some(isInitial);
}

/**
 * Recognize Indian name patterns
 */
function recognizeIndianName(tokens: string[]): { pattern: IndianNamePattern; confidence: 'HIGH' | 'MEDIUM' | 'LOW' } {
    const lowerTokens = tokens.map(t => t.toLowerCase());
    const meaningfulTokens = tokens.filter(t => !isInitial(t) && !isHonorific(t));

    // Single name pattern
    if (meaningfulTokens.length === 1) {
        const single = meaningfulTokens[0].toLowerCase();
        if (COMMON_INDIAN_FIRST_NAMES.has(single)) {
            return { pattern: 'SINGLE_NAME', confidence: 'MEDIUM' };
        }
        return { pattern: 'SINGLE_NAME', confidence: 'LOW' };
    }

    // Initials-heavy pattern (more initials than names)
    const initialCount = tokens.filter(isInitial).length;
    if (initialCount > meaningfulTokens.length) {
        return { pattern: 'INITIALS_HEAVY', confidence: 'MEDIUM' };
    }

    // Sikh pattern (ends with Singh/Kaur)
    const lastMeaningful = meaningfulTokens[meaningfulTokens.length - 1]?.toLowerCase();
    if (lastMeaningful === 'singh' || lastMeaningful === 'kaur') {
        return { pattern: 'SIKH', confidence: 'HIGH' };
    }

    // Muslim pattern (starts with Mohammad variants or has Khan, etc.)
    const muslimPrefixes = ['mohammad', 'mohammed', 'muhammed', 'md', 'sheikh', 'shaikh'];
    const muslimSurnames = ['khan', 'qureshi', 'siddiqui', 'ansari', 'pathan', 'malik', 'mirza', 'syed', 'begum'];
    if (muslimPrefixes.includes(lowerTokens[0]) || meaningfulTokens.some(t => muslimSurnames.includes(t.toLowerCase()))) {
        return { pattern: 'MUSLIM', confidence: 'HIGH' };
    }

    // Christian pattern (common Christian first names + Thomas/George/etc.)
    const christianNames = ['john', 'joseph', 'thomas', 'george', 'abraham', 'mary', 'susan', 'elizabeth'];
    if (meaningfulTokens.some(t => christianNames.includes(t.toLowerCase()))) {
        return { pattern: 'CHRISTIAN', confidence: 'MEDIUM' };
    }

    // South Indian pattern (initial + name or double-barreled)
    const southIndianSurnames = ['iyer', 'iyengar', 'rao', 'reddy', 'naidu', 'nair', 'menon', 'pillai', 'nayar'];
    if (meaningfulTokens.some(t => southIndianSurnames.includes(t.toLowerCase()))) {
        return { pattern: 'SOUTH_INDIAN', confidence: 'HIGH' };
    }

    // Bengali pattern
    const bengaliSurnames = ['das', 'dey', 'dutta', 'sen', 'ghosh', 'bose', 'roy', 'chatterjee', 'mukherjee', 'banerjee'];
    if (meaningfulTokens.some(t => bengaliSurnames.includes(t.toLowerCase()))) {
        return { pattern: 'BENGALI', confidence: 'HIGH' };
    }

    // North Indian pattern (default for recognized Indian surnames)
    const northIndianSurnames = ['sharma', 'verma', 'gupta', 'jain', 'agarwal', 'bansal', 'goel', 'goyal', 'joshi', 'tiwari'];
    if (meaningfulTokens.some(t => northIndianSurnames.includes(t.toLowerCase()) || COMMON_SURNAMES.has(t.toLowerCase()))) {
        return { pattern: 'NORTH_INDIAN', confidence: 'HIGH' };
    }

    // Check if first name is recognized
    if (COMMON_INDIAN_FIRST_NAMES.has(meaningfulTokens[0]?.toLowerCase())) {
        return { pattern: 'NORTH_INDIAN', confidence: 'MEDIUM' };
    }

    return { pattern: 'UNKNOWN', confidence: 'LOW' };
}

// =============================================================================
// Batch Validation
// =============================================================================

export interface BatchValidationResult {
    readonly totalCount: number;
    readonly validCount: number;
    readonly invalidCount: number;
    readonly results: readonly NameValidationResult[];
}

/**
 * Validate multiple names at once
 */
export function validateIndianNames(names: string[]): BatchValidationResult {
    const results = names.map(validateIndianName);
    const validCount = results.filter(r => r.valid).length;

    return {
        totalCount: names.length,
        validCount,
        invalidCount: names.length - validCount,
        results,
    };
}
