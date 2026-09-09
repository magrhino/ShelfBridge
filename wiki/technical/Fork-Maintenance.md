# Maintaining this fork

This fork maintains ShelfBridge with additional matching, sync, reporting, and
cache fixes. The original project is
[rohit-purandare/ShelfBridge](https://github.com/rohit-purandare/ShelfBridge).
The MIT license and original attribution remain in place.

## Publish an image

The default branch is `fork`. Pushes and pull requests run checks but do not
publish images. In GitHub Actions, select **Publish fork image**, choose
**Run workflow**, and select `fork`.

The workflow tests the dispatched commit, builds AMD64 and ARM64 images, and
checks native SQLite modules and cache lifecycle on both platforms. Only after
these checks pass does it update `ghcr.io/magrhino/shelfbridge:fork`. A failed
build or verification leaves that moving tag unchanged. Publishing runs are
serialized. No Release Please token or version number is needed.
The legacy `release.yml` workflow is disabled in repository settings so updating
the upstream tracking branch cannot launch upstream release automation. Keep it
disabled; the manual workflow lives in `fork-publish.yml`.

Each build also has a `sha-<full-commit-sha>` tag. The workflow summary records
the image digest; use the digest when an immutable deployment is needed. A
rebuild of the same commit can replace its SHA tag, but not its old digest.

The GHCR package must be public for anonymous pulls. Its settings are separate
from repository visibility. Publishing uses the repository's `GITHUB_TOKEN`.

## Deploy or roll back

Use `ghcr.io/magrhino/shelfbridge:fork` in Compose, then run:

```sh
docker compose pull
docker compose up -d
```

Keep the same config and data volumes. To pin a build or roll back, replace the
Compose image with `ghcr.io/magrhino/shelfbridge@sha256:<verified-digest>` from a
previous successful workflow summary, then run the same commands. An image
rollback does not restore application data; keep normal backups of the volumes.

## Select upstream changes

Keep `main` as an upstream tracking branch. Do not use GitHub's **Sync fork**
action on `fork`, and do not automatically merge upstream into it.

```sh
git fetch upstream
git log --oneline fork..upstream/main
git show <selected-commit>
git switch fork
git pull --ff-only origin fork
git switch -c codex/import-upstream-change
git cherry-pick -x <selected-commit>
npm test
npm run lint
npm run format:check
```

Check dependencies and patch equivalence before cherry-picking: an upstream
commit may already contain one of this fork's fixes under a different SHA.
Resolve conflicts while preserving the fork's behavior and tests, then open a
PR targeting `fork`. Import workflow changes deliberately so they cannot
restore automatic releases or upstream registry destinations.

Update the tracking branch separately, using only a fast-forward:

```sh
git switch main
git merge --ff-only upstream/main
git push origin main
git switch fork
```

## Initial integration

The initial fork preserves the combined development work, aligns it with the
upstream baseline used by the split PRs, and merges the latest heads of upstream
PRs #236–#244. Those PR branches remain intact. This includes the later direct
identifier title guards, work/collection identity checks, numeric ASIN fallback,
first-progress failure handling, and updated edition-resolution test fixtures.
Combined-only canonical title, numbered-volume, and failed-match classification
changes remain included. Git merge ancestry records each imported PR head.
