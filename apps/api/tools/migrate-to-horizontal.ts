import { Project } from 'ts-morph';
import * as path from 'path';

async function migrate() {
  const project = new Project({
    tsConfigFilePath: path.join(__dirname, '../tsconfig.json'),
  });

  const sourceFiles = project.getSourceFiles();

  for (const sourceFile of sourceFiles) {
    const oldPath = sourceFile.getFilePath();

    // Only process files inside src/modules/
    if (!oldPath.includes('/src/modules/')) {
      continue;
    }

    const relativePath = oldPath.split('/src/modules/')[1]; // e.g., 'users/domain/entities/user.entity.ts'
    const parts = relativePath.split('/');
    const moduleName = parts[0];
    const layer = parts[1]; // domain, application, infrastructure, presentation, or the module.ts itself

    let newPath = '';

    if (layer === 'domain') {
      // domain/entities -> core/entities
      // domain/value-objects -> core/value-objects
      // domain/repositories -> core/repositories
      // domain/services -> core/services
      const subLayer = parts[2];
      const rest = parts.slice(3).join('/');
      newPath = path.join(__dirname, '../src/core', subLayer, rest);
    } else if (layer === 'application') {
      // application/use-cases -> application/use-cases
      // application/dto -> application/dtos
      // application/ports -> application/ports
      // application/services -> application/services
      // application/mappers -> application/mappers
      let subLayer = parts[2];
      if (subLayer === 'dto') subLayer = 'dtos';
      const rest = parts.slice(3).join('/');
      newPath = path.join(__dirname, '../src/application', subLayer, rest);
    } else if (layer === 'infrastructure') {
      // infrastructure/repositories -> infrastructure/database/repositories
      // infrastructure/dispatch -> infrastructure/external-services/dispatch
      // infrastructure/adapters -> infrastructure/external-services/adapters
      const subLayer = parts[2];
      const rest = parts.slice(3).join('/');
      if (subLayer === 'repositories' || subLayer === 'models') {
        newPath = path.join(__dirname, '../src/infrastructure/database', subLayer, rest);
      } else {
        newPath = path.join(__dirname, '../src/infrastructure/external-services', subLayer, rest);
      }
    } else if (layer === 'presentation') {
      // presentation/controllers -> infrastructure/http/controllers
      // presentation/guards -> infrastructure/http/guards
      const subLayer = parts[2];
      const rest = parts.slice(3).join('/');
      newPath = path.join(__dirname, '../src/infrastructure/http', subLayer, rest);
    } else if (relativePath.endsWith('.module.ts')) {
      // module files -> infrastructure/http/routes/ or just infrastructure/modules/
      const fileName = parts[parts.length - 1];
      newPath = path.join(__dirname, '../src/infrastructure/http/routes', fileName);
    } else {
      // Any other stray files, keep module name context
      const rest = parts.slice(1).join('/');
      newPath = path.join(__dirname, '../src/infrastructure/misc', moduleName, rest);
    }

    if (newPath) {
      console.log(`Moving: ${relativePath} -> ${newPath.split('src')[1]}`);
      sourceFile.moveToDirectory(path.dirname(newPath));
    }
  }

  console.log('Saving AST changes (this updates all import statements)...');
  await project.save();
  console.log('Migration complete!');
}

migrate().catch(console.error);
