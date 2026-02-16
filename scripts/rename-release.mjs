import { renameSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const packageJson = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
const version = packageJson.version;

const firefoxXpi = path.join(repoRoot, 'tabs-de-clutter-firefox.xpi');
const chromeZip = path.join(repoRoot, 'tabs-de-clutter-chrome.zip');

const firefoxXpiVersioned = path.join(repoRoot, `tabs-de-clutter-firefox-v${version}.xpi`);
const chromeZipVersioned = path.join(repoRoot, `tabs-de-clutter-chrome-v${version}.zip`);

try {
  renameSync(firefoxXpi, firefoxXpiVersioned);
  renameSync(chromeZip, chromeZipVersioned);
} catch (error) {
  console.error('Error renaming files:', error);
  process.exit(1);
}
