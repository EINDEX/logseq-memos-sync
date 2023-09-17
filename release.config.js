module.exports = {
  tagFormat: "v${version}",
  branches: ["main"],
  plugins: [
    [
      "@semantic-release/commit-analyzer",
      {
        preset: "conventionalcommits",
        releaseRules: [{ type: "chore", release: "patch" }],
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
