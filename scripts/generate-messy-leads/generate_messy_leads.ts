import { fakerEN_IN as faker } from '@faker-js/faker';
import ExcelJS from 'exceljs';
import path from 'path';

// --- Configuration ---
const CONFIG = {
    FILENAME: 'pivotr-leads-template.xlsx',
    DEFAULT_ROWS: 50,
    HEADER_ROW_INDEX: 10,
    SHEET_INDEX: 1, // 1-based
    HEADERS: [
        'Full Name',
        'Email',
        'Company Name',
        'Phone Number',
        'Lead Type'
    ]
};

// --- Messy Logic Generators ---

function messyName(): string {
    let name = faker.person.fullName();

    const messType = faker.number.int({ min: 0, max: 4 });
    switch (messType) {
        case 0: // Erratic Casing
            return name.split('').map(c => Math.random() > 0.5 ? c.toUpperCase() : c.toLowerCase()).join('');
        case 1: // Honorifics
            const honorific = faker.person.prefix();
            return `${honorific} ${name}`;
        case 2: // Whitespace
            return `  ${name}   `;
        case 3: // Duplicate Name (Typo repetition)
            const parts = name.split(' ');
            return `${parts[0]} ${parts[0]} ${parts[1]}`;
        default:
            return name;
    }
}

function messyEmail(name: string): string {
    if (Math.random() < 0.1) return ''; // Random missing email

    let email = faker.internet.email({ firstName: name.split(' ')[0], lastName: name.split(' ')[1] });

    const messType = faker.number.int({ min: 0, max: 5 });
    switch (messType) {
        case 0: // Domain Typo
            email = email.replace('gmail.com', 'gmil.com')
                .replace('yahoo.co.in', 'yhoo.in')
                .replace('.com', '.co');
            return email;
        case 1: // Missing @
            return email.replace('@', '');
        case 2: // Spaces
            return email.replace('@', ' @ ');
        case 3: // Multiple Emails
            const validEmail = faker.internet.email();
            const separator = Math.random() > 0.5 ? ', ' : ' / ';
            return `${email}${separator}${validEmail}`;
        case 4: // Invalid Char
            return `"${email}"`;
        default:
            return email;
    }
}

function messyCompany(): string {
    let company = faker.company.name();
    // Strip default suffixes to add our own messy ones sometimes
    company = company.replace(/ (Pvt Ltd|Ltd|Inc)$/i, '');

    const messType = faker.number.int({ min: 0, max: 4 });
    const suffixes = ['Pvt Ltd', 'Private Limited', 'L.L.P.', 'Inc.', 'Enterprises'];

    switch (messType) {
        case 0: // Inconsistent Suffix
            return `${company} ${faker.helpers.arrayElement(suffixes)}`;
        case 1: // Double Suffix
            return `${company} ${faker.helpers.arrayElement(suffixes)} ${faker.helpers.arrayElement(suffixes)}`;
        case 2: // Special Characters
            return `${company} & Sons @ Ind`;
        case 3: // Double Spacing
            return `${company}  ${faker.helpers.arrayElement(suffixes)}`;
        default:
            return company + ' ' + faker.helpers.arrayElement(suffixes);
    }
}

const INDIAN_MOBILE_PREFIXES = ['9', '8', '7', '6'];

function messyPhone(): string {
    if (Math.random() < 0.05) return '';

    const prefix = faker.helpers.arrayElement(INDIAN_MOBILE_PREFIXES);
    const rest = faker.string.numeric(9);
    let basic = `${prefix}${rest}`; // 10 digit

    const messType = faker.number.int({ min: 0, max: 6 });
    switch (messType) {
        case 0: // Valid +91
            return `+91 ${basic.substring(0, 5)} ${basic.substring(5)}`;
        case 1: // 0 prefix
            return `0${basic}`;
        case 2: // 91 prefix no plus
            return `91${basic}`;
        case 3: // Dashes
            return `+91-${basic.substring(0, 5)}-${basic.substring(5)}`;
        case 4: // Invalid Length (Short)
            return faker.string.numeric(9);
        case 5: // Invalid Length (Long)
            return faker.string.numeric(12);
        case 6: // Random spaces
            return `${basic.substring(0, 3)} ${basic.substring(3, 7)} ${basic.substring(7)}`;
        default:
            return `+91${basic}`;
    }
}

// --- Main Execution ---

async function main() {
    const targetRows = process.argv[2] ? parseInt(process.argv[2]) : CONFIG.DEFAULT_ROWS;
    const filePath = path.resolve(CONFIG.FILENAME);

    console.log(`Loading workbook from: ${filePath}`);
    console.log(`Generating ${targetRows} messy rows...`);

    const workbook = new ExcelJS.Workbook();

    try {
        await workbook.xlsx.readFile(filePath);
    } catch (err) {
        console.error(`Error reading file: ${(err as Error).message}`);
        process.exit(1);
    }

    const worksheet = workbook.getWorksheet(CONFIG.SHEET_INDEX);
    if (!worksheet) {
        console.error('Worksheet not found!');
        process.exit(1);
    }

    // Validate Headers
    const headerRow = worksheet.getRow(CONFIG.HEADER_ROW_INDEX);
    // ExcelJS values is 1-indexed, index 0 is null
    const fileHeaders = (headerRow.values as string[]).slice(1);

    // Basic validation - check if crucial headers exist
    const crucial = ['Full Name', 'Email', 'Company Name'];
    const mapping: Record<string, number> = {};

    fileHeaders.forEach((h, idx) => {
        if (h) mapping[h.trim()] = idx + 1; // +1 because slice removed index 0, but we want 1-based column index
    });

    // Verify headers
    const missing = crucial.filter(c => !Object.keys(mapping).some(k => k.includes(c)));
    if (missing.length > 0) {
        console.warn(`Warning: Could not strictly match headers ${missing.join(', ')}.`);
        console.warn(`Found headers: ${fileHeaders.join(', ')}`);
        // Fallback: Assume standard column order based on our inspection
        // 1: Full Name, 2: Email, 3: Company Name, 4: Phone Number, 5: Lead Type
        mapping['Full Name'] = 1;
        mapping['Email'] = 2;
        mapping['Company Name'] = 3;
        mapping['Phone Number'] = 4;
        mapping['Lead Type'] = 5;
    }

    // Find start row (first empty row after header)
    let currentRow = CONFIG.HEADER_ROW_INDEX + 1;
    while (worksheet.getRow(currentRow).getCell(1).value || worksheet.getRow(currentRow).getCell(2).value) {
        currentRow++;
    }

    // Leave a small gap or start immediately? Template usually has data until it ends. 
    // Let's assume we append immediately after the last data row.

    console.log(`Appending data starting at Row ${currentRow}`);

    for (let i = 0; i < targetRows; i++) {
        const r = worksheet.getRow(currentRow + i);

        const name = messyName();
        const type = faker.helpers.arrayElement(['HARDWARE', 'SOFTWARE', 'BOTH', 'HARDWARE', 'SOFTWARE']); // Bias towards valid

        r.getCell(mapping['Full Name'] || 1).value = name;
        r.getCell(mapping['Email'] || 2).value = messyEmail(name);
        r.getCell(mapping['Company Name'] || 3).value = messyCompany();
        r.getCell(mapping['Phone Number'] || 4).value = messyPhone();
        r.getCell(mapping['Lead Type'] || 5).value = type;

        r.commit();
    }

    console.log('Use "bun run generate_messy_leads.ts" to run this script.');
    console.log('Saving file...');
    await workbook.xlsx.writeFile(filePath);
    console.log('Done!');
}

main().catch(console.error);
