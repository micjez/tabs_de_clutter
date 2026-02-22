import { rm, mkdir, cp, access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const SRC_DIR = path.join(repoRoot, 'src');
const DIST_DIR = path.join(repoRoot, 'dist');

async function pathExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function safeRm(dir) {
  await rm(dir, { recursive: true, force: true });
}

async function copyDir(from, to) {
  await mkdir(to, { recursive: true });
  await cp(from, to, { recursive: true, force: true });
}

async function copyFile(from, to) {
  await mkdir(path.dirname(to), { recursive: true });
  await cp(from, to, { force: true });
}

function stripEsm(code) {
  return code
    // drop import lines
    .replace(/^\s*import\s+[\s\S]*?;\s*$/gm, '')
    // remove export keywords (named exports)
    .replace(/^\s*export\s+(?=async\s+function|function|const|let|var|class)/gm, '')
    // remove `export { ... }` re-export blocks
    .replace(/^\s*export\s*\{[\s\S]*?\};\s*$/gm, '');
}

async function createXPI(sourceDir, outputPath) {
  try {
    // Remove existing XPI if it exists
    if (await pathExists(outputPath)) {
      await rm(outputPath);
    }
    execSync(`npx web-ext build --source-dir="${sourceDir}" --artifacts-dir="${path.dirname(outputPath)}" --filename="${path.basename(outputPath)}" --overwrite-dest`, { stdio: 'inherit' });
  } catch (error) {
    console.error('Error creating XPI:', error);
    throw error;
  }
}

async function createZIP(sourceDir, outputPath) {
  try {
    // Remove existing ZIP if it exists
    if (await pathExists(outputPath)) {
      await rm(outputPath);
    }
    execSync(`cd "${sourceDir}" && zip -r "${outputPath}" .`, { stdio: 'inherit' });
  } catch (error) {
    console.error('Error creating ZIP:', error);
    throw error;
  }
}

async function writeFileUtf8(filePath, content) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
}

async function buildFirefoxDist(outDir) {
  const sharedDir = path.join(SRC_DIR, 'shared');

  // Copy shared assets first (icon etc.)
  await copyDir(sharedDir, outDir);

  // Copy correctly sized icons
  await copyFile(path.join(sharedDir, 'icon-48.png'), path.join(outDir, 'icon-48.png'));
  await copyFile(path.join(sharedDir, 'icon-96.png'), path.join(outDir, 'icon-96.png'));

  // Rewrite HTML to not use module scripts
  const popupHtml = await readFile(path.join(sharedDir, 'popup.html'), 'utf8');
  await writeFileUtf8(
    path.join(outDir, 'popup.html'),
    popupHtml.replace(/<script\s+type="module"\s+src="popup\.js"><\/script>/g, '<script src="popup.js"></script>')
  );

  const optionsHtml = await readFile(path.join(sharedDir, 'options.html'), 'utf8');
  await writeFileUtf8(
    path.join(outDir, 'options.html'),
    optionsHtml.replace(/<script\s+type="module"\s+src="options\.js"><\/script>/g, '<script src="options.js"></script>')
  );

  // Bundle JS (very small project => simple concatenation)
  const extCode = stripEsm(await readFile(path.join(sharedDir, 'ext.js'), 'utf8'));
  const utilsCode = stripEsm(await readFile(path.join(sharedDir, 'utils.js'), 'utf8'));
  const fileHandlerCode = stripEsm(await readFile(path.join(sharedDir, 'file-handler.js'), 'utf8'));
  const openAiClientCode = stripEsm(await readFile(path.join(sharedDir, 'openai-client.js'), 'utf8'));
  const backgroundCode = stripEsm(await readFile(path.join(sharedDir, 'background.js'), 'utf8'));
  const popupCode = stripEsm(await readFile(path.join(sharedDir, 'popup.js'), 'utf8'));
  const optionsCode = stripEsm(await readFile(path.join(sharedDir, 'options.js'), 'utf8'));

  await writeFileUtf8(
    path.join(outDir, 'background.js'),
    `${extCode}\n${utilsCode}\n${fileHandlerCode}\n${openAiClientCode}\n${backgroundCode}`
  );
  await writeFileUtf8(path.join(outDir, 'popup.js'), `${extCode}\n${popupCode}`);
  await writeFileUtf8(
    path.join(outDir, 'options.js'),
    `${extCode}\n${utilsCode}\n${openAiClientCode}\n${optionsCode}`
  );

  // Ensure the standalone modules are not left around to confuse debugging.
  // (They were copied by copyDir above; overwrite with MV2-friendly bundles.)
  await writeFileUtf8(path.join(outDir, 'ext.js'), extCode);
  await writeFileUtf8(path.join(outDir, 'utils.js'), utilsCode);
}

async function buildBrowser(browserName) {
  const outDir = path.join(DIST_DIR, browserName);
  const sharedDir = path.join(SRC_DIR, 'shared');
  const browserDir = path.join(SRC_DIR, browserName);

  await safeRm(outDir);
  await mkdir(outDir, { recursive: true });

  if (browserName === 'firefox') {
    await buildFirefoxDist(outDir);
  } else {
    await copyDir(sharedDir, outDir);
  }

  await copyFile(path.join(browserDir, 'manifest.json'), path.join(outDir, 'manifest.json'));
}

async function main() {
  await safeRm(DIST_DIR);
  await mkdir(DIST_DIR, { recursive: true });

  await buildBrowser('chrome');
  await buildBrowser('firefox');

  // Generate XPI for Firefox
  const firefoxDir = path.join(DIST_DIR, 'firefox');
  const xpiPath = path.join(repoRoot, 'tabs-de-clutter-firefox.xpi');
  await createXPI(firefoxDir, xpiPath);

  // Generate ZIP for Chrome
  const chromeDir = path.join(DIST_DIR, 'chrome');
  const zipPath = path.join(repoRoot, 'tabs-de-clutter-chrome.zip');
  await createZIP(chromeDir, zipPath);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
