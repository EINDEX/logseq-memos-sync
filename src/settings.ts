import "@logseq/libs";

export enum Mode {
  CustomPage = "Custom Page",
  Journal = "Journal",
  JournalGrouped = "Journal Grouped",
}

export enum BackgroundSync {
  Off = "Off",
  HalfHourly = "Half-Hourly",
  Hourly = "Hourly",
  BiHourly = "Bi-Hourly",
  Minutely = "Minutely",
}

export enum Visibility {
  Public = "Public",
  Protected = "Protected",
  Private = "Private",
}

export default function settingSchema() {
  logseq.useSettingsSchema([
    {
      key: "",
      type: "heading",
      default: "",
      title: "Memos Connection",
      description: "",
    },
    {
      key: "host",
      type: "string",
      title: "Open API",
      description: "example: memos.com:8080",
      default: "",
    },
    {
      key: "token",
      type: "string",
      title: "Token",
      description: " Your memos API token, you can find this in memos setting",
      default: "",
    },
    {
      key: "openId",
      type: "string",
      title: "Open Id",
      description: "Please upgrade memos to v0.15.0 switch to Memos Token. Memos OpenId, you can find this in memos setting.",
      default: "",
    },
    {
      key: "",
      type: "heading",
      default: "",
      title: "Sync to Logseq",
      description: "fetch memos to Logseq",
    },

    {
      key: "autoSync",
      type: "boolean",
      title: "Auto Sync",
      description: "Also sync when open Logseq",
      default: false,
    },
    {
      key: "mode",
      type: "enum",
      title: "Mode",
      description: "Mode to Sync Memos",
      default: "Journal Grouped",
      enumChoices: Object.values(Mode),
      enumPicker: "radio",
    },
    {
      key: "customPage",
      type: "string",
      title: "Custom Page",
      description:
        "Custom Page Mode Only: You can choose a page to store Sync Memos",
      default: "Memos",
    },
    {
      key: "backgroundSync",
      type: "enum",
      title: "Background Sync",
      description:
        "Sync Memos background, you can set this to `Half-Hourly` or `Hourly` or `Bi-Hourly`, If you want to sync memos very frequently, you can set this to `Minutely`",
      default: "Hourly",
      enumChoices: Object.values(BackgroundSync),
      enumPicker: "radio",
    },
    {
      key: "inboxName",
      type: "string",
      title: "Memos Inbox Name",
      description:
        "Journal Grouped Only: Messages will be pasted in daily journal into block with text, specified in inboxName property. Replace it in case of necessary.",
      default: "#Memos",
    },
    {
      key: "tagFilter",
      type: "string",
      title: "Choose memos tag to sync",
      description:
        "Only sync memos with this tag, leave it blank to sync all memos. You can use `|` to sync multiple tags, like `tag1|tag2` PS: without `#`",
      default: "",
    },
    {
      key: "",
      type: "heading",
      default: "",
      title: "Sync to Memos",
      description: "send information to memos",
    },
    {
      key: "sendVisibility",
      type: "enum",
      title: "Default Visibility for send block to memos",
      description:
        "Sending block back to memos, what is the visibility you want to used? PS: reopen logseq to apply this change.",
      default: [],
      enumChoices: Object.values(Visibility),
      enumPicker: "checkbox",
    },
    {
      key: "",
      type: "heading",
      default: "",
      title: "Advanced",
      description:
        "The features in this area have huge impact on your data, use it only when you know what are you doing",
    },
    {
      key: "archiveMemoAfterSync",
      type: "boolean",
      title: "Archive memo after sync",
      description:
        "If this option is on, private memos will be archived after sync to Logseq.",
      default: "false",
    },
    {
      key: "includeArchive",
      type: "boolean",
      title: "Include archive",
      description: "Sync archive memos to Logseq",
      default: false,
    },
    {
      key: "fullSync",
      type: "string",
      title: "Full Sync",
      description:
        "Input `Agree`, to make a full sync for next time sync.(this not override your data)",
      default: "",
    },
    {
      key: "flat",
      type: "boolean",
      title: "Flat Result",
      description: "Flat all your result.",
      default: false,
    },
    {
      key: "syncStatus",
      type: "object",
      title: "Sync Status (Internal Use)",
      description: "Internal sync status tracking - DO NOT MODIFY",
      default: { lastSyncId: 0 },
    },
  ]);
}
