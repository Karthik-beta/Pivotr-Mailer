/**
 * Indian Surnames Dictionary
 *
 * Used by the Indian Name Parser to identify surnames that may appear
 * at the beginning of a name (in "Surname FirstName" format).
 *
 * ⚠️ WARNING: This list should NOT include names that are commonly used
 * as both first names and surnames. See POSITION_DEPENDENT_NAMES for those.
 */

/**
 * Common Indian surnames
 * All entries should be lowercase
 */
export const COMMON_SURNAMES = new Set([
	// North Indian surnames
	'sharma',
	'verma',
	'gupta',
	'singh', // Can be first name too, but predominantly surname
	'jain',
	'agarwal',
	'agrawal',
	'aggarwal',
	'bansal',
	'mittal',
	'goel',
	'goyal',
	'joshi',
	'tiwari',
	'tiwary',
	'tripathi',
	'pandey',
	'pandya',
	'mishra',
	'misra',
	'shukla',
	'dubey',
	'dwivedi',
	'chaturvedi',
	'upadhyay',
	'saxena',
	'srivastava',
	'srivastav',
	'rastogi',
	'khanna',
	'kapoor',
	'kapur',
	'malhotra',
	'bhatia',
	'arora',
	'chadha',
	'chopra',
	'kohli',
	'ahuja',
	'anand',
	'bedi',
	'bhalla',
	'dhawan',
	'gujral',
	'handa',
	'jolly',
	'khurana',
	'luthra',
	'mehra',
	'mehta',
	'nagpal',
	'oberoi',
	'puri',
	'sahni',
	'sethi',
	'sodhi',
	'tandon',
	'vohra',
	'walia',

	// South Indian surnames
	'iyer',
	'iyengar',
	'rao',
	'reddy',
	'naidu',
	'nair',
	'menon',
	'pillai',
	'nayar',
	'kurup',
	'varma',
	'panikkar',
	'kaimal',
	'namboothiri',
	'nambiar',
	'mudaliar',
	'mudali',
	'chettiar',
	'chetty',
	'thevar',
	'naicker',
	'nayak',
	'gowda',
	'hegde',
	'shetty',
	'shenoy',
	'kamath',
	'bhat',
	'bhatt',
	'pai',
	'prabhu',

	// East Indian surnames
	'das',
	'dey',
	'dutta',
	'dutt',
	'sen',
	'sengupta',
	'ghosh',
	'bose',
	'roy',
	'choudhury',
	'chowdhury',
	'chatterjee',
	'chattopadhyay',
	'mukherjee',
	'mukhopadhyay',
	'banerjee',
	'bandyopadhyay',
	'ganguly',
	'gangopadhyay',
	'bhattacharya',
	'bhattacharyya',
	'majumdar',
	'mazumdar',
	'chakraborty',
	'chakrabarti',
	'sarkar',
	'barua',
	'hazarika',
	'bora',
	'kalita',

	// West Indian surnames
	'patel',
	'shah',
	'desai',
	'parikh',
	'modi',
	'gandhi',
	'thakkar',
	'thakker',
	'kothari',
	'trivedi',
	'dave',
	'vyas',
	'raval',
	'parekh',
	'sheth',
	'dalal',
	'shroff',

	// Muslim surnames
	'khan',
	'qureshi',
	'siddiqui',
	'ansari',
	'shaikh',
	'sheikh',
	'pathan',
	'malik',
	'mirza',
	'sayyid',
	'syed',
	'hashmi',

	// Sikh surnames
	'sidhu',
	'gill',
	'dhillon',
	'sandhu',
	'brar',
	'bajwa',
	'grewal',
	'mann',
	'hundal',
	'johal',
	'randhawa',
	'cheema',
	'virk',
	'saini',
	'chahal',

	// Christian surnames (common in South India)
	'abraham',
	'george',
	'jacob',
	'john',
	'joseph',
	'mathew',
	'philip',
	'samuel',
	'simon',
	'thomas',
	'varghese',
]);

/**
 * Names that can be first names OR surnames depending on position
 *
 * These should NOT be used as split points when they appear at the
 * beginning or middle of a name (they're likely first names there).
 *
 * Example: "Kumar Sanu" - Kumar is the first name
 * Example: "Rajesh Kumar" - Kumar is the surname
 */
export const POSITION_DEPENDENT_NAMES = new Set([
	'kumar', // Very common as both first name and surname/middle name
	'mohan', // Can be first name (Mohan Lal) or suffix (Raj Mohan)
	'lal', // Can be first name (Lal Bahadur) or suffix (Mohan Lal)
	'chand', // Can be first name or suffix (Krishan Chand)
	'chandra', // Can be first name or suffix
	'prasad', // Usually suffix but can be first name
	'ram', // Very common first name (Ram Kumar)
	'pal', // Can be suffix (Gopal) or surname
	'dev', // Can be first name or surname
	'nath', // Usually suffix (Vishwa Nath)
	'prakash', // Can be first name or middle name
	'kishore', // Can be first name
	'kishor', // Can be first name
]);
