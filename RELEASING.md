# Release Process

QuickDir uses semantic versioning and GitHub Releases for distribution.

## 1. Cut a release

Pick the appropriate bump level:

```bash
# Bug fixes only
npm run release:patch

# New features, backward compatible
npm run release:minor

# Breaking changes
npm run release:major
```

This runs three steps automatically:

1. **Bumps** the version in `package.json`
2. **Generates** a new section in `CHANGELOG.md` from commits since the last tag
3. **Commits** all changes and creates a git tag (`v0.2.0`, etc.)

Commit messages must follow the prefix convention documented in `AGENTS.md` — the changelog generator (`scripts/changelog.js`) groups entries by prefix.

## 2. Push and build

```bash
git push && git push --tags
npm run build:win
```

## 3. Publish to GitHub Releases

1. Go to **Releases → New Release** on GitHub
2. Select the tag that was just pushed (e.g. `v0.2.0`)
3. Paste the relevant section from `CHANGELOG.md` as the release notes
4. Upload the installer from `release/` (e.g. `QuickDir Setup 0.2.0.exe`)
5. Publish

Users download the latest installer from the Releases page.
