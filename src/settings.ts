import "@logseq/libs";

export default function settingSchema() {
  logseq.useSettingsSchema([
    {
      key: "openAPI",
      type: "string",
      title: "Open API",
      description: "Memos Open API, you can find this in memos setting",
      default: "",
    },
    {
      key: "",
      type: "heading",
      default: "",
      title: "Sync to Logseq",
      description: "fetch infomation to Logseq",
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
      enumChoices: ["Custom Page", "Journal", "Journal Grouped"],
      enumPicker: "select",
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
      default: "Off",
      enumChoices: ["Off", "Minutely", "Half-Hourly", "Hourly", "Bi-Hourly"],
      enumPicker: "select",
    },
    {
      key: "includeArchive",
      type: "boolean",
      title: "Include archive",
      description: "Sync archive memos to Logseq",
      default: false,
    },
    {
      key: "inboxName",
      type: "string",
      title: "Title in Page",
      description:
          "Journal Grouped Only: Messages will be pasted in daily journal into block with text, specified in inboxName property. Replace it in case of necessary.",
      default: "#Memos",
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
          "Sending block back to memos, what is the default visibility? If you enable it, you will just see one send button in the slash menu",
      default: "Private",
      enumChoices: ["Off", "Public", "Protected", "Private"],
      enumPicker: "select",
    },
    {
      key: "",
      type: "heading",
      default: "",
      title: "Advanced",
      description: "The features in this area have huge impact on your data, use it only when you know what are you doing",
    },
    {
      key: "archiveMemoAfterSync",
      type: "boolean",
      title: "Archive memo after sync",
      description:
          "If this option is on, memos will be archived after sync to Logseq.",
      default: "false",
    },
  ]);
}
