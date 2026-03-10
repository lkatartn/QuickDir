const { execSync } = require('child_process');
const { version } = require('../package.json');

const tag = `v${version}`;

try {
  execSync('git add -A', { stdio: 'inherit' });
  execSync(`git commit -m "release: ${tag}"`, { stdio: 'inherit' });
  execSync(`git tag ${tag}`, { stdio: 'inherit' });
  console.log(`\nTagged ${tag}`);
  console.log(`\nNext steps:`);
  console.log(`  git push && git push --tags`);
  console.log(`  npm run build`);
  console.log(`  Upload release/ artifacts to GitHub Release ${tag}`);
} catch (err) {
  console.error('Release commit failed:', err.message);
  process.exit(1);
}
