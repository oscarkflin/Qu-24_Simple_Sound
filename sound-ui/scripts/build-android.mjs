import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('..', import.meta.url));
const win = process.platform === 'win32';
const result = spawnSync(
  win ? 'gradlew.bat' : './gradlew',
  ['assembleDebug', '--console=plain'],
  { cwd: path.join(root, 'android'), stdio: 'inherit', shell: win },
);
if (result.error) console.error(result.error.message);
if (result.status !== 0) process.exit(result.status || 1);
mkdirSync(path.join(root, 'outputs'), { recursive: true });
const destination = path.join(root, 'outputs', 'Sunday-Sound-Demo.apk');
copyFileSync(
  path.join(
    root,
    'android',
    'app',
    'build',
    'outputs',
    'apk',
    'debug',
    'app-debug.apk',
  ),
  destination,
);
console.log(`Demo APK: ${destination}`);
