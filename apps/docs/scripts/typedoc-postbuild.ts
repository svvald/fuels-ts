import { readdirSync, mkdirSync, copyFileSync, renameSync, writeFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import replace from 'replace';
import { fileURLToPath } from 'url';

type Link = {
  link: string;
  text: string;
  items: Link[];
  collapsed?: boolean;
};

type RegexReplacement = {
  regex: string;
  replacement: string;
};

/**
 * Post build script to trim off undesired leftovers from Typedoc, restructure directories and generate json for links.
 */
const filename = fileURLToPath(import.meta.url);
const docsDir = join(dirname(filename), '../src/');
const apiDocsDir = join(docsDir, '/api');
const classesDir = join(apiDocsDir, '/classes');
const modulesDir = join(apiDocsDir, '/modules');
const interfacesDir = join(apiDocsDir, '/interfaces_typedoc');
const enumsDir = join(apiDocsDir, '/enums');

const filesToRemove = [
  'api/modules.md',
  'api/classes',
  'api/modules',
  'api/interfaces_typedoc',
  'api/enums',
];

const secondaryEntryPoints = ['-index.md', '-test_utils.md', '-cli_utils.md'];
const secondaryModules: string[] = [];

const filePathReplacements: RegexReplacement[] = [];

const { log } = console;

/**
 * Removes unwanted files and dirs generated by typedoc.
 */
const removeUnwantedFiles = () =>
  filesToRemove.forEach((dirPath) => {
    const fullDirPath = join(docsDir, dirPath);
    rmSync(fullDirPath, { recursive: true, force: true });
  });

const renameInterfaces = () => {
  renameSync(join(apiDocsDir, 'interfaces'), join(apiDocsDir, 'interfaces_typedoc'));
};

/**
 * Generates a json file containing the links for the sidebar to be used by vitepress.
 */
const exportLinksJson = () => {
  const links: Link = { link: '/api/', text: 'API', collapsed: true, items: [] };
  const directories = readdirSync(apiDocsDir);
  directories
    .filter((directory) => !directory.endsWith('.md'))
    .forEach((directory) => {
      links.items.push({ text: directory, link: `/api/${directory}/`, collapsed: true, items: [] });
      readdirSync(join(apiDocsDir, directory))
        .filter((file) => {
          // Exclude index files and files related to secondary entry points
          const isIndexFile = file.endsWith('index.md');
          const isSecondaryEntryPoint = secondaryEntryPoints.some((entryPoint) =>
            file.includes(entryPoint.replace('_', '-').replace('.md', ''))
          );
          return !isIndexFile && !isSecondaryEntryPoint;
        })
        .forEach((file) => {
          const index = links.items.findIndex((item) => item.text === directory);
          if (index !== -1) {
            const name = file.split('.')[0];
            links.items[index].items.push({
              text: name,
              link: `/api/${directory}/${name}`,
              items: [],
            });
          }
        });
    });

  writeFileSync('.typedoc/api-links.json', JSON.stringify(links));
};

/**
 * Flattens the module files generated by typedoc. Only necessary where a package
 * has multiple entry points.
 */
const flattenSecondaryModules = () => {
  const modulesFiles = readdirSync(modulesDir);
  const classesFiles = readdirSync(classesDir);
  const interfacesFiles = readdirSync(interfacesDir);
  const enumsFiles = readdirSync(enumsDir);

  const files = [
    ...classesFiles.map((c) => ({ name: c, path: classesDir })),
    ...interfacesFiles.map((i) => ({ name: i, path: interfacesDir })),
    ...enumsFiles.map((e) => ({ name: e, path: enumsDir })),
  ];

  // Extract secondary modules
  secondaryModules.push(
    ...modulesFiles
      .filter((file) => secondaryEntryPoints.some((entryPoint) => file.includes(entryPoint)))
      .map((file) => file.replace('fuel_ts_', ''))
      .map((file) => file.split('.')[0])
  );

  // Move files to the primary module
  secondaryModules.forEach((secondaryModule) => {
    const primaryModule = secondaryModule.split('-')[0];
    files.forEach(({ name, path }) => {
      if (name.includes(secondaryModule)) {
        const nameWithPrimaryModule = name.replace(secondaryModule, primaryModule);
        renameSync(join(path, name), join(path, nameWithPrimaryModule));

        // Regenerate internal links for primary module
        filePathReplacements.push({
          regex: name.replace('.md', ''),
          replacement: nameWithPrimaryModule.replace('.md', ''),
        });
      }
    });
  });
};

/**
 * Alters the typedoc generated file structure to be more semantic.
 */
const alterFileStructure = () => {
  const modulesFiles = readdirSync(modulesDir);
  const classesFiles = readdirSync(classesDir);
  const interfacesFiles = readdirSync(interfacesDir);
  const enumsFiles = readdirSync(enumsDir);

  const files = [
    ...classesFiles.map((c) => ({ name: c, path: classesDir })),
    ...interfacesFiles.map((i) => ({ name: i, path: interfacesDir })),
    ...enumsFiles.map((e) => ({ name: e, path: enumsDir })),
  ];

  modulesFiles.forEach((modulesFile) => {
    // Create a new directory for each module
    const newDirName = modulesFile.split('.')[0];
    const newDirPath = join(apiDocsDir, newDirName);
    mkdirSync(newDirPath);

    // Prepare new module directory to remove 'fuel_ts_' prefix
    const formattedDirName = newDirPath.split('fuel_ts_')[1];
    const capitalisedDirName = formattedDirName.charAt(0).toUpperCase() + formattedDirName.slice(1);

    files.forEach(({ name, path }) => {
      if (name.startsWith(newDirName)) {
        const newFilePath = join(newDirPath, name);
        copyFileSync(join(path, name), newFilePath);

        // Rename the file to remove module prefix
        const newName = name.split('-')[1];
        renameSync(newFilePath, join(newDirPath, newName));
        // Push a replacement for internal links cleanup
        filePathReplacements.push({
          regex: name,
          replacement: `/api/${capitalisedDirName}/${newName}`,
        });
      }
    });

    // Move module index file
    copyFileSync(join(modulesDir, modulesFile), join(newDirPath, 'index.md'));

    // Push a replacement for internal links cleanup
    filePathReplacements.push({
      regex: modulesFile,
      replacement: `/api/${capitalisedDirName}/index.md`,
    });

    // Rename module directory to capitalised name
    renameSync(newDirPath, join(apiDocsDir, capitalisedDirName));
  });
};

/**
 * Cleans up the secondary modules generated by typedoc.
 */
const cleanupSecondaryModules = () => {
  secondaryModules.forEach((secondaryModule) => {
    const primaryModule = secondaryModule.split('-')[0];
    const capitalisedSecondaryModuleName =
      secondaryModule.charAt(0).toUpperCase() + secondaryModule.slice(1);
    const capitalisedPrimaryModuleName =
      primaryModule.charAt(0).toUpperCase() + primaryModule.slice(1);

    const oldFilePath = join(apiDocsDir, capitalisedSecondaryModuleName, 'index.md');

    // Format the name so there isn't multiple index files for a single package
    let newFileName = secondaryModule.split('-')[1];
    newFileName = newFileName === 'index' ? 'src-index' : `${newFileName.replace('_', '-')}-index`;
    const newFilePath = join(apiDocsDir, capitalisedPrimaryModuleName, `${newFileName}.md`);

    // Move the secondary module index file to the primary module
    renameSync(oldFilePath, newFilePath);

    // Regenerate links for the secondary module
    filePathReplacements.push({
      regex: `${capitalisedSecondaryModuleName}/index`,
      replacement: `${capitalisedPrimaryModuleName}/${newFileName}`,
    });

    // Remove the secondary module
    rmSync(join(apiDocsDir, capitalisedSecondaryModuleName), { recursive: true, force: true });
  });
};

/**
 * Recreates the generated typedoc links
 */
const recreateInternalLinks = () => {
  const topLevelDirs = readdirSync(apiDocsDir);

  const prefixReplacements: RegexReplacement[] = [
    // Prefix/Typedoc cleanups
    { regex: '../modules/', replacement: '/api/' },
    { regex: '../classes/', replacement: '/api/' },
    { regex: '../interfaces/', replacement: '/api/' },
    { regex: '../enums/', replacement: '/api/' },
    { regex: 'fuel_ts_', replacement: '' },
    { regex: '/api//api/', replacement: '/api/' },
    // Resolves `[plugin:vite:vue] Element is missing end tag.` error
    { regex: '<', replacement: '&lt;' },
  ];

  topLevelDirs
    .filter((directory) => !directory.endsWith('.md'))
    .forEach((dir) => {
      [...filePathReplacements, ...prefixReplacements].forEach(({ regex, replacement }) => {
        replace({
          regex,
          replacement,
          paths: [join(apiDocsDir, dir)],
          recursive: true,
          silent: true,
        });
      });
    });
};

const main = () => {
  log('Cleaning up API docs.');
  renameInterfaces();
  flattenSecondaryModules();
  alterFileStructure();
  cleanupSecondaryModules();
  removeUnwantedFiles();
  exportLinksJson();
  recreateInternalLinks();
};

main();
