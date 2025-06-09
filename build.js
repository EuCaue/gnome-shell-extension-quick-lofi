import { execSync } from 'child_process';
import { cpSync, readFileSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';
const __dirname = dirname(fileURLToPath(import.meta.url));
const metadata = JSON.parse(readFileSync('./src/metadata.json', 'utf-8'));

function prepareFiles() {
  const filesToCopy = [
    {
      src: 'src/metadata.json',
      dist: 'dist/metadata.json',
    },
    {
      src: 'schemas',
      dist: 'dist/schemas',
    },
    {
      src: 'icons',
      dist: 'dist/icons',
    },
    {
      src: 'src/resources',
      dist: 'dist/resources',
    },
  ];

  filesToCopy.forEach(({ src, dist }) => {
    cpSync(resolve(__dirname, src), resolve(__dirname, dist), { recursive: true });
  });

  rmSync(resolve(__dirname, 'dist/resources/quick-lofi.gresource.xml'));

  execSync(
    'glib-compile-resources src/resources/quick-lofi.gresource.xml --target=dist/resources/quick-lofi.gresource --sourcedir=src/resources',
    {
      stdio: 'inherit',
    },
  );
}

function main() {
  console.log(`Building ${metadata.name} v${metadata['shell-version']}...`);
  execSync('npx rollup -c', { stdio: 'inherit' });

  prepareFiles();

  const zipFilename = `${metadata.uuid}.zip`;
  const zipDist = resolve(__dirname, zipFilename);

  const zip = new AdmZip();
  zip.addLocalFolder(resolve(__dirname, 'dist'));
  zip.writeZip(zipDist);

  console.log(`Build complete. Zip file: ${zipFilename}\n`);
  console.log(`Install with: gnome-extensions install ${zipFilename}`);
  console.log(`Update with: gnome-extensions install --force ${zipFilename}`);
  console.log(`Enable with: gnome-extensions enable ${metadata.uuid}`);
  console.log('');
  console.log(`Disable with: gnome-extensions disable ${metadata.uuid}`);
  console.log(`Remove with: gnome-extensions uninstall ${metadata.uuid}`);
  console.log('');
  console.log('To check if the extension has been recognized, you can execute the following: gnome-extensions list.');
  console.log(`If ${metadata.uuid} is listed in the output, you should be able to activate the extension.`);
  console.log('Otherwise, you will need to restart the GNOME Shell.');
}

main();
