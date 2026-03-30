import fs from 'fs';
import path from 'path';

const SRC_DIR = path.join(process.cwd(), 'src/modules');

const getFiles = (dir, ext) => {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(filePath, ext));
    } else if (file.endsWith(ext)) {
      results.push(filePath);
    }
  });
  return results;
};

// Replace @Inject(SYMBOL) with direct class injects
const serviceFiles = getFiles(SRC_DIR, '.service.ts');
serviceFiles.push(...getFiles(SRC_DIR, '.processor.ts'));

serviceFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');

  // Replace @Inject(_REPOSITORY) private readonly xxxRepo: IxxxRepository
  // with private readonly xxxRepo: XxxRepository
  // It should also remove the import! Wait, it's easier to use a regex that matches:
  // @Inject(...) private readonly xxxRepo: I(\w+)Repository
  // -> private readonly xxxRepo: $1Repository
  content = content.replace(/@Inject\([A-Z_]+_REPOSITORY\)\s+(?:private\s+|public\s+|protected\s+)?readonly\s+(\w+Repo\w*):\s+I(\w+)Repository/g, 'private readonly $1: $2Repository');

  // Also fix imports
  // Replace: import { SYMBOL, I...Repository } from ".../xxx.repository"
  // with: import { ...Repository } from ".../xxx.repository"
  content = content.replace(/import\s+\{\s*[A-Z_]+_REPOSITORY(?:,\s*|\s*,\s*|)\s*I(\w+Repository)\s*\}\s+from\s+(['"].+?(?:\.repository)['"]);/g, "import { $1 } from $2;");

  // In some files, maybe it only imports I...Repository
  content = content.replace(/I(\w+Repository)/g, '$1');

  fs.writeFileSync(file, content, 'utf8');
});

// Update the module files to provide concrete classes
const moduleFiles = getFiles(SRC_DIR, '.module.ts');

moduleFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');

  // Replace { provide: SYMBOL, useClass: Prisma...Repository }
  // with ...Repository
  const repoRegex = /\{\s*provide:\s*[A-Z_]+_REPOSITORY,\s*useClass:\s+Prisma(\w+Repository)\s*\}/g;
  content = content.replace(repoRegex, '$1');

  // Fix imports
  content = content.replace(/import\s+\{\s*[A-Z_]+_REPOSITORY\s*\}\s+from\s+['"][^'"]+['"];/g, '');
  content = content.replace(/import\s+\{\s*Prisma(\w+Repository)\s*\}\s+from\s+(['"][^'"]+['"]);/g, 'import { $1 } from $2;');

  // Remove empty lines created by import deletion
  content = content.replace(/\n\s*\n\s*\n/g, '\n\n');

  fs.writeFileSync(file, content, 'utf8');
});

console.log('DI Refactoring completed.');
