/**
 * Copy public folder to standalone output
 * Next.js standalone mode doesn't automatically copy the public folder,
 * so we need to do it manually for Heroku deployment.
 */

const fs = require('fs');
const path = require('path');

const sourceDir = path.join(process.cwd(), 'public');
const targetDir = path.join(process.cwd(), '.next', 'standalone', 'public');

function copyRecursive(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    // Create destination directory if it doesn't exist
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    
    // Copy all files and subdirectories
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursive(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    // Copy file
    fs.copyFileSync(src, dest);
  }
}

// Copy public folder to standalone output
if (fs.existsSync(sourceDir)) {
  console.log('Copying public folder to standalone output...');
  copyRecursive(sourceDir, targetDir);
  console.log('✓ Public folder copied successfully');
} else {
  console.warn('⚠ Public folder not found, skipping copy');
}

// Copy static files to standalone output if they exist in main .next/static
// Next.js standalone mode may not automatically include these
const mainStaticDir = path.join(process.cwd(), '.next', 'static');
const standaloneStaticTarget = path.join(process.cwd(), '.next', 'standalone', '.next', 'static');

if (fs.existsSync(mainStaticDir) && !fs.existsSync(standaloneStaticTarget)) {
  console.log('Copying static files to standalone output...');
  try {
    // Create the .next directory in standalone if it doesn't exist
    const standaloneNextDir = path.join(process.cwd(), '.next', 'standalone', '.next');
    if (!fs.existsSync(standaloneNextDir)) {
      fs.mkdirSync(standaloneNextDir, { recursive: true });
    }
    
    copyRecursive(mainStaticDir, standaloneStaticTarget);
    console.log('✓ Static files copied to standalone output');
  } catch (error) {
    console.warn('⚠ WARNING: Failed to copy static files to standalone:', error.message);
    console.warn('   Static files may not be available in production');
  }
} else if (fs.existsSync(standaloneStaticTarget)) {
  console.log('✓ Static files already exist in standalone output');
}

// Verify static files exist (check multiple possible locations)
const standaloneStaticDir = path.join(process.cwd(), '.next', 'standalone', '.next', 'static');
// mainStaticDir already declared above

let staticDirFound = false;
let staticDirPath = '';

// Check standalone location first
if (fs.existsSync(standaloneStaticDir)) {
  staticDirFound = true;
  staticDirPath = standaloneStaticDir;
  console.log('✓ Static files directory exists in standalone output');
} else if (fs.existsSync(mainStaticDir)) {
  // Static files might be in main .next/static (Next.js serves them from there)
  staticDirFound = true;
  staticDirPath = mainStaticDir;
  console.log('✓ Static files directory exists in main .next/static');
  console.log('  (Next.js standalone server will serve from this location)');
} else {
  console.warn('⚠ WARNING: Static files directory not found in expected locations');
  console.warn('   This may indicate a build issue, but the server might still work.');
  console.warn('   Expected locations:');
  console.warn('     -', standaloneStaticDir);
  console.warn('     -', mainStaticDir);
}

// If static directory found, verify chunks
if (staticDirFound) {
  const chunksDir = path.join(staticDirPath, 'chunks');
  if (fs.existsSync(chunksDir)) {
    const chunkFiles = fs.readdirSync(chunksDir);
    console.log(`✓ Found ${chunkFiles.length} chunk files in static/chunks/`);
    if (chunkFiles.length === 0) {
      console.warn('⚠ WARNING: No chunk files found - this will cause 404 errors');
    }
  } else {
    console.warn('⚠ WARNING: chunks directory not found - this may cause 404 errors');
  }
  
  // Check for CSS files
  const cssDir = path.join(staticDirPath, 'css');
  if (fs.existsSync(cssDir)) {
    const cssFiles = fs.readdirSync(cssDir);
    console.log(`✓ Found ${cssFiles.length} CSS files`);
  }
}

// Verify server.js exists
const serverFile = path.join(process.cwd(), '.next', 'standalone', 'server.js');
if (fs.existsSync(serverFile)) {
  console.log('✓ Standalone server.js exists');
} else {
  console.error('❌ ERROR: server.js not found in standalone output!');
  console.error('   Expected location:', serverFile);
  process.exit(1);
}

console.log('\n✓ Build verification complete');

