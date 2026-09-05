import { spawnSync } from 'node:child_process';

const requested = String(process.argv[2] || 'all').toLowerCase();
if (!['all', 'macos', 'android', 'ios'].includes(requested)) {
  console.error('Usage: npm run native:doctor -- [macos|android|ios]');
  process.exit(1);
}

function available(command, args = ['--version']) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  return result.status === 0;
}

const checks = [
  ['Node.js 24+', Number(process.versions.node.split('.')[0]) >= 24, process.version],
  ['Rust compiler', available('rustc'), 'Install with rustup'],
  ['Cargo', available('cargo'), 'Installed with Rust'],
  ['Tauri CLI', available('npx', ['tauri', '--version']), 'Run npm install'],
];
if (requested === 'all' || requested === 'macos' || requested === 'ios')
  checks.push(['Xcode tools', available('xcodebuild', ['-version']), 'Install Xcode or its command-line tools']);
if (requested === 'all' || requested === 'ios')
  checks.push(['CocoaPods', available('pod'), 'Install CocoaPods for iOS']);
if (requested === 'all' || requested === 'android') {
  checks.push(['Java', available('java'), 'Use the JBR included with Android Studio']);
  checks.push(['Android SDK', Boolean(process.env.ANDROID_HOME), 'Set ANDROID_HOME']);
  checks.push(['Android NDK', Boolean(process.env.NDK_HOME), 'Set NDK_HOME']);
}

for (const [name, ok, advice] of checks)
  console.log(`${ok ? '✓' : '✗'} ${String(name).padEnd(16)} ${ok ? '' : advice}`.trimEnd());
const missing = checks.filter(([, ok]) => !ok).length;
console.log(missing ? `\n${missing} prerequisite${missing === 1 ? '' : 's'} missing.` : '\nNative toolchain ready.');
process.exitCode = missing ? 1 : 0;
