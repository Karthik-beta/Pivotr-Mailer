import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

console.log('\n=== Hot Reload Configuration Check ===\n');

// Test 1: Verify watch exclusions
console.log('1. Checking watch exclusions...');
try {
  const watchExcludePath = resolve(process.cwd(), '.aws-sam', 'watch-exclude.txt');
  const exclusions = readFileSync(watchExcludePath, 'utf-8');
  const requiredExclusions = ['tests/**', 'node_modules/**', 'dist/**'];
  
  for (const pattern of requiredExclusions) {
    if (exclusions.includes(pattern)) {
      console.log(`   OK ${pattern} excluded`);
    } else {
      console.log(`   MISSING ${pattern} NOT excluded`);
    }
  }
} catch {
  console.log('   ERROR .aws-sam/watch-exclude.txt not found');
}

// Test 2: Verify samconfig.toml
console.log('\n2. Checking samconfig.toml configuration...');
try {
  const samConfigPath = resolve(process.cwd(), 'samconfig.toml');
  const samConfig = readFileSync(samConfigPath, 'utf-8');
  
  const requiredSettings = [
    { key: 'watch = true', desc: 'Watch mode enabled' },
    { key: 'cached = true', desc: 'Build caching enabled' },
    { key: 'parallel = true', desc: 'Parallel builds enabled' }
  ];
  
  for (const { key, desc } of requiredSettings) {
    if (samConfig.includes(key)) {
      console.log(`   OK ${desc}`);
    } else {
      console.log(`   MISSING ${desc} NOT configured`);
    }
  }
} catch {
  console.log('   ERROR samconfig.toml not found');
}

// Test 3: Verify layer package.json
console.log('\n3. Checking SharedUtilsLayer configuration...');
const layerPackageJsonPath = resolve(process.cwd(), 'lambda', 'shared', 'package.json');
if (existsSync(layerPackageJsonPath)) {
  console.log('   OK lambda/shared/package.json exists');
  
  try {
    const packageJson = JSON.parse(readFileSync(layerPackageJsonPath, 'utf-8'));
    
    // Check for exports configuration
    if (packageJson.exports) {
      console.log('   OK package.json exports configured');
      const expectedExports = ['./logger', './clients', './config', './utils', './errors'];
      for (const exp of expectedExports) {
        if (packageJson.exports[exp]) {
          console.log(`   OK export "${exp}" defined`);
        } else {
          console.log(`   MISSING export "${exp}" not defined`);
        }
      }
    } else {
      console.log('   MISSING package.json exports not configured');
    }
  } catch {
    console.log('   ERROR could not parse lambda/shared/package.json');
  }
} else {
  console.log('   MISSING lambda/shared/package.json not found');
}

// Test 4: Verify template.yaml BuildMethod
console.log('\n4. Checking template.yaml BuildMethod...');
try {
  const templatePath = resolve(process.cwd(), 'template.yaml');
  const template = readFileSync(templatePath, 'utf-8');
  
  if (template.includes('BuildMethod: nodejs20.x')) {
    console.log('   OK SharedUtilsLayer BuildMethod is nodejs20.x');
  } else if (template.includes('BuildMethod: esbuild')) {
    console.log('   ERROR SharedUtilsLayer BuildMethod is esbuild (should be nodejs20.x)');
  } else {
    console.log('   WARNING Could not determine BuildMethod');
  }
} catch {
  console.log('   ERROR template.yaml not found');
}

console.log('\n=== Configuration Check Complete ===\n');