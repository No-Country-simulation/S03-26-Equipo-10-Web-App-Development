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

const repositoryFiles = getFiles(SRC_DIR, '.repository.ts');
const prismaRepos = repositoryFiles.filter(f => path.basename(f).startsWith('prisma-'));

prismaRepos.forEach(prismaFile => {
  const dir = path.dirname(prismaFile);
  const baseName = path.basename(prismaFile).replace('prisma-', '');
  const interfaceFile = path.join(dir, baseName);
  
  if (!fs.existsSync(interfaceFile)) {
    console.log(`Interface file not found for ${prismaFile}`);
    return;
  }

  // 1. Read both files
  const prismaContent = fs.readFileSync(prismaFile, 'utf8');
  let interfaceContent = fs.readFileSync(interfaceFile, 'utf8');

  // 2. Extract Types/Interfaces from interface file
  // Removes `export const SYMBOL = Symbol(...)` and `export interface I...Repository { ... }`
  const typesToKeep = interfaceContent
    .replace(/export const \w+_REPOSITORY = Symbol\([^)]+\);/g, '')
    .replace(/export interface I\w+Repository\s*\{[\s\S]*?^\}/gm, '')
    .trim();

  // 3. Transform Prisma implementation
  let newContent = prismaContent;
  
  // Remove interface implementation: `implements IUserRepository`
  newContent = newContent.replace(/ implements I\w+Repository/g, '');
  
  // Rename class: `PrismaUserRepository` -> `UserRepository`
  newContent = newContent.replace(/class Prisma(\w+)Repository/g, 'class $1Repository');

  // Remove import of interfaces from interface file:
  newContent = newContent.replace(new RegExp(`import\\s+\\{[^\\}]+\\}\\s+from\\s+['"]\\.\\/${baseName.replace('.ts', '')}['"];?\\n?`, 'g'), '');

  // Add extracted types at the top (after other imports)
  const importsEndIndex = newContent.lastIndexOf('import ');
  const insertIndex = newContent.indexOf('\n', importsEndIndex) + 1;
  
  if (typesToKeep && insertIndex > 0) {
    newContent = newContent.slice(0, insertIndex) + '\n' + typesToKeep + '\n' + newContent.slice(insertIndex);
  }

  // 4. Save into the base name file (overwriting the interface file)
  fs.writeFileSync(interfaceFile, newContent, 'utf8');

  // 5. Delete the prisma file
  fs.unlinkSync(prismaFile);
  console.log(`Merged ${path.basename(prismaFile)} into ${baseName}`);
});

console.log('Repositories merged successfully.');
