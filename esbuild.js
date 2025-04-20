import { build } from 'esbuild';
import { copyFileSync, cpSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';
import { readFileSync } from 'fs';
const metadata = JSON.parse(readFileSync('./src/metadata.json', 'utf-8'));

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  console.debug(`Building ${metadata.name} v${metadata.version}...`);

  await build({
    entryPoints: ['src/extension.ts', 'src/prefs.ts'],
    outdir: 'dist',
    bundle: true,
    treeShaking: false,
    target: 'firefox78',
    platform: 'node',
    format: 'esm',
    external: ['gi://*', 'resource://*', 'system', 'gettext', 'cairo'],
  });

  const filesToCopy = [
    { src: 'src/metadata.json', dist: 'dist/metadata.json' },
    { src: 'src/stylesheet.css', dist: 'dist/stylesheet.css' },
  ];

  filesToCopy.forEach(({ src, dist }) => {
    copyFileSync(resolve(__dirname, src), resolve(__dirname, dist));
  });

  cpSync(resolve(__dirname, 'schemas/'), resolve(__dirname, 'dist/schemas/'), { recursive: true });
  cpSync(resolve(__dirname, 'icons/'), resolve(__dirname, 'dist/icons/'), { recursive: true });

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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
