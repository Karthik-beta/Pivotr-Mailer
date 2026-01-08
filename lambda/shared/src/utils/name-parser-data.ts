/**
 * Indian Name Parser Data
 * 
 * Contains sets of common Honorifics and Surnames used for parsing.
 */

/**
 * Common honorific prefixes in Indian names
 * All entries should be lowercase, without periods
 */
export const HONORIFIC_PREFIXES = new Set([
    // English titles
    'mr', 'mrs', 'ms', 'miss', 'dr', 'prof', 'professor', 'master', 'rev', 'reverend',

    // Hindi/Sanskrit titles
    'shri', 'shree', 'sri', 'sree', 'shrimati', 'shreemati', 'srimati', 'smt',
    'kumari', 'kumar', 'pandit', 'pt', 'swami', 'acharya', 'guru', 'sant', 'baba', 'mata', 'devi',

    // Tamil titles
    'thiru', 'thirumathi', 'selvi', 'selvan',

    // Professional titles
    'ca', 'cs', 'adv', 'advocate', 'er', 'ar', 'cma',

    // Military/Police
    'col', 'colonel', 'lt', 'lieutenant', 'capt', 'captain', 'maj', 'major',
    'gen', 'general', 'brig', 'brigadier', 'comdt', 'commandant', 'insp', 'inspector',
    'si', 'asi',

    // Judicial
    'justice', 'hon', 'honorable', 'honourable',
]);

/**
 * Common honorific suffixes in Indian names
 */
export const HONORIFIC_SUFFIXES = new Set([
    // Academic
    'phd', 'dphil', 'md', 'mbbs', 'bds', 'mba', 'mca', 'btech', 'mtech',
    'be', 'me', 'bsc', 'msc', 'ba', 'ma', 'llb', 'llm',

    // Professional certifications
    'fca', 'aca', 'fcs', 'acs', 'cfa', 'cpa',

    // Civil services
    'ias', 'ips', 'ifs', 'irs',

    // Generational
    'jr', 'junior', 'sr', 'senior', 'ii', 'iii', 'iv',

    // Religious
    'ji', 'sahib', 'saheb',
]);

/**
 * Common Indian surnames
 */
export const COMMON_SURNAMES = new Set([
    // North Indian
    'sharma', 'verma', 'gupta', 'singh', 'jain', 'agarwal', 'agrawal', 'aggarwal',
    'bansal', 'mittal', 'goel', 'goyal', 'joshi', 'tiwari', 'tiwary', 'tripathi',
    'pandey', 'pandya', 'mishra', 'misra', 'shukla', 'dubey', 'dwivedi', 'chaturvedi',
    'upadhyay', 'saxena', 'srivastava', 'srivastav', 'rastogi', 'khanna', 'kapoor',
    'kapur', 'malhotra', 'bhatia', 'arora', 'chadha', 'chopra', 'kohli', 'ahuja',
    'anand', 'bedi', 'bhalla', 'dhawan', 'gujral', 'handa', 'jolly', 'khurana',
    'luthra', 'mehra', 'mehta', 'nagpal', 'oberoi', 'puri', 'sahni', 'sethi',
    'sodhi', 'tandon', 'vohra', 'walia',

    // South Indian
    'iyer', 'iyengar', 'rao', 'reddy', 'naidu', 'nair', 'menon', 'pillai', 'nayar',
    'kurup', 'varma', 'panikkar', 'kaimal', 'namboothiri', 'nambiar', 'mudaliar',
    'mudali', 'chettiar', 'chetty', 'thevar', 'naicker', 'nayak', 'gowda', 'hegde',
    'shetty', 'shenoy', 'kamath', 'bhat', 'bhatt', 'pai', 'prabhu',

    // East Indian
    'das', 'dey', 'dutta', 'dutt', 'sen', 'sengupta', 'ghosh', 'bose', 'roy',
    'choudhury', 'chowdhury', 'chatterjee', 'chattopadhyay', 'mukherjee',
    'mukhopadhyay', 'banerjee', 'bandyopadhyay', 'ganguly', 'gangopadhyay',
    'bhattacharya', 'bhattacharyya', 'majumdar', 'mazumdar', 'chakraborty',
    'chakrabarti', 'sarkar', 'barua', 'hazarika', 'bora', 'kalita',

    // West Indian
    'patel', 'shah', 'desai', 'parikh', 'modi', 'gandhi', 'thakkar', 'thakker',
    'kothari', 'trivedi', 'dave', 'vyas', 'raval', 'parekh', 'sheth', 'dalal', 'shroff',

    // Muslim
    'khan', 'qureshi', 'siddiqui', 'ansari', 'shaikh', 'sheikh', 'pathan',
    'malik', 'mirza', 'sayyid', 'syed', 'hashmi',

    // Sikh
    'sidhu', 'gill', 'dhillon', 'sandhu', 'brar', 'bajwa', 'grewal', 'mann',
    'hundal', 'johal', 'randhawa', 'cheema', 'virk', 'saini', 'chahal',

    // Christian
    'abraham', 'george', 'jacob', 'john', 'joseph', 'mathew', 'philip',
    'samuel', 'simon', 'thomas', 'varghese',
]);

/**
 * Names that can be first names OR surnames depending on position
 */
export const POSITION_DEPENDENT_NAMES = new Set([
    'kumar', 'mohan', 'lal', 'chand', 'chandra', 'prasad', 'ram',
    'pal', 'dev', 'nath', 'prakash', 'kishore', 'kishor',
]);
