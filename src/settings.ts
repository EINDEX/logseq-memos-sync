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
      default: "Custom Page",
      enumChoices: ["Journal", "Custom Page"],
      enumPicker: "select",
    },
    {
      key: "customPage",
      type: "string",
      title: "Custom Page",
      description:
        "When you using `Custom Page` mode. You can choose a page to store Sync Memos",
      default: "Memos",
    },
    {
      key: "backgroundSync",
      type: "enum",
      title: "Background Sync",
      description:
        "Sync Memos background, you can set this to `Half-Hourly` or `Hourly` or `Bi-Hourly`",
      default: "Off",
      enumChoices: ["Off", "Half-Hourly", "Hourly", "Bi-Hourly"],
      enumPicker: "select",
    },
    {
      key: "includeArchive",
      type: "boolean",
      title: "Include archive",
      description: "Sync archive memos",
      default: false,
    },
    // {
    //   key: "",
    //   type: "heading",
    //   default: "",
    //   title: "Sync to Memos",
    //   description: "send infomation to memos",
    // },
    // {
    //   key: "sendVisiblity",
    //   type: "enum",
    //   title: "Default Visibility for send block to memos",
    //   description:
    //     "Sending block back to memos, what is the default visibility?",
    //   default: "Private",
    //   enumChoices: ["Public", "Protected", "Private"],
    //   enumPicker: "select",
    // },
  ]);
}
