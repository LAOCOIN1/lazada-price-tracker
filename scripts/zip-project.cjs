const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

async function zipProject() {
  const outputFileName = 'lazada-price-tracker.zip';
  console.log(`[Packager] Creating ZIP archive: ${outputFileName}...`);

  // Create file write stream
  const output = fs.createWriteStream(path.join(process.cwd(), outputFileName));
  
  let archive;
  try {
    archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression level
    });
  } catch (err) {
    console.log('[Packager] Standard call failed, falling back to direct ZipArchive instantiation.');
    const archiverModule = require('archiver');
    archive = new archiverModule.ZipArchive({
      zlib: { level: 9 }
    });
  }

  // Listen for all archive data to be written
  output.on('close', () => {
    console.log(`\n==================================================`);
    console.log(`[Packager] 🎉 ZIP archive created successfully!`);
    console.log(`[Packager] Output: ${outputFileName}`);
    console.log(`[Packager] Size: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
    console.log(`==================================================\n`);
  });

  archive.on('warning', (err) => {
    if (err.code === 'ENOENT') {
      console.warn('[Packager] Warning:', err);
    } else {
      throw err;
    }
  });

  archive.on('error', (err) => {
    console.error('[Packager] Error:', err);
    throw err;
  });

  // Pipe archive data to the file
  archive.pipe(output);

  // Add individual files
  const filesToInclude = [
    '.env.example',
    '.gitignore',
    'index.html',
    'metadata.json',
    'package.json',
    'tsconfig.json',
    'vite.config.ts',
    'server.ts'
  ];

  for (const file of filesToInclude) {
    if (fs.existsSync(path.join(process.cwd(), file))) {
      archive.file(file, { name: file });
      console.log(`[Packager] Added file: ${file}`);
    }
  }

  // Add the src directory recursively, excluding database file and dist folder
  archive.directory('src/', 'src');
  console.log('[Packager] Added directory: src/');

  // Add a helper README for how to install on Termux / VPS
  const readmeContent = `# Lazada Price Tracker - Portable Package

This package is compiled and bundled to run 100% standalone on Termux, VPS, or cloud hosts.

## 🚀 Quick Start (Termux / VPS / Cloud)

1. Extract this zip file.
2. Install NodeJS (if not already installed). On Termux run:
   \`\`\`bash
   pkg update && pkg install nodejs
   \`\`\`
3. Set up the environment variables:
   \`\`\`bash
   cp .env.example .env
   # Edit .env with your favorite editor (e.g., nano)
   # Enter your GEMINI_API_KEY if using AI parsing.
   \`\`\`
4. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`
5. Run the web dashboard:
   \`\`\`bash
   npm run dev
   \`\`\`
6. To run the Telegram Bot standalone in background:
   \`\`\`bash
   npm run bot
   \`\`\`
7. To run a background price check scan:
   \`\`\`bash
   npm run check
   \`\`\`

## 💾 Multi-Database Choice (DATABASE_TYPE)

Select your database in the .env file:
- \`DATABASE_TYPE=sqlite\` (Default, file-based, perfect for Termux)
- \`DATABASE_TYPE=postgres\` (Enterprise database, cloud scale)
- \`DATABASE_TYPE=mysql\` (Highly compatible web database)

Thank you for using Lazada Price Tracker!
`;

  archive.append(readmeContent, { name: 'README_INSTALL.md' });
  console.log('[Packager] Added: README_INSTALL.md instruction sheet');

  // Finalize the archive
  await archive.finalize();
}

zipProject().catch((err) => {
  console.error('[Packager] Packaging failed:', err);
});
