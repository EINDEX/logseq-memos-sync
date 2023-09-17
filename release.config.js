module.exports = {
  tagFormat: "v${version}",
  branches: [
    "v+([0-9])?(.{+([0-9]),x}).x",
    "+([0-9])?(.{+([0-9]),x}).x",
    "main",
    "next",
    "next-major",
    { name: "beta", prerelease: true },
    { name: "alpha", prerelease: true },
  ],

  plugins: [
    [
      "@semantic-release/commit-analyzer",
      {
        preset: "conventionalcommits",
      },
    ],
    "@semantic-release/release-notes-generator",
    "@semantic-release/changelog",
    [
      "@semantic-release/exec",
      {
        prepareCmd:
          "zip -qq -r logseq-memos-sync-${nextRelease.version}.zip dist readme.md logo.webp LICENSE package.json",
      },
    ],
    [
      "@semantic-release/github",
      {
        assets: "logseq-memos-sync-*.zip",
      },
    ],
  ],
};
