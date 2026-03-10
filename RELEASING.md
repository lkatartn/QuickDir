# Release Process

QuickDir uses semantic versioning and GitHub Releases for distribution. CI builds both Windows and macOS installers automatically.

## Quick Reference

```bash
npm run release:patch          # 1.0.0 → 1.0.1
npm run release:minor          # 1.0.0 → 1.1.0
npm run release:major          # 1.0.0 → 2.0.0
git push && git push --tags    # triggers CI build + draft release
```

## Step by Step

### 1. Write commits with prefixes

The changelog generator groups commits by prefix. Use these:

| Prefix | Category |
|---|---|
| `feat:` | Features |
| `fix:` | Bug Fixes |
| `perf:` | Performance |
| `refactor:` | Refactoring |
| `ui:` | UI Changes |
| `build:` | Build |
| `docs:` | Documentation |
| `chore:` | Chores |

Scopes are optional: `feat(column-view): add keyboard navigation`

### 2. Cut a release

```bash
npm run release:patch    # bug fixes
npm run release:minor    # new features
npm run release:major    # breaking changes
```

This automatically:
1. Bumps the version in `package.json`
2. Generates a new section in `CHANGELOG.md` from git history
3. Commits everything and creates a git tag (`v1.0.1`, etc.)

### 3. Push — CI builds automatically

```bash
git push && git push --tags
```

Pushing a `v*` tag triggers GitHub Actions (`.github/workflows/release.yml`):

1. Builds **Windows NSIS installer** on `windows-latest`
2. Builds **macOS DMG + ZIP** on `macos-latest`
3. Creates a **draft GitHub Release** with all artifacts attached

Both platforms build in parallel (~5–10 minutes).

### 4. Publish the release

1. Go to **Releases** on GitHub — a new **draft** release will be waiting
2. Edit the release notes (paste the relevant section from `CHANGELOG.md`)
3. Click **Publish release**

## Building Locally

For testing builds without CI:

```bash
# Windows NSIS installer (must run on Windows)
npm run build:win

# macOS DMG + ZIP (must run on macOS)
npm run build:mac

# Auto-detect current platform
npm run build
```

Artifacts are written to the `release/` directory.

## Version Scripts

These bump the version without committing (useful if you want manual control):

```bash
npm run version:patch    # bump patch only
npm run version:minor    # bump minor only
npm run version:major    # bump major only
npm run changelog        # regenerate CHANGELOG.md only
```
