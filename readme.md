# logseq-memos-sync

> A memos sync plugin for logseq

<a href="https://www.buymeacoffee.com/eindex"><img src="https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&emoji=&slug=eindex&button_colour=40DCA5&font_colour=ffffff&font_family=Cookie&outline_colour=000000&coffee_colour=FFDD00" /></a>

## Features

- Sync memos to logseq via memos openAPI
- Auto Sync memos when start Logseq
- Can send block to Memos now!
- Allow sync memos with tags.

## How to use

1. Open plugin setting, setting up Memos openAPI

### Manually Sync
1. Open Logseq command panel, Win `Ctrl + Shift + P` or macOS `Command + Shift + P`.
2. Search for Sync Memos
3. Run it

### Automatic Sync
1. Open plugin setting and checked `autoSync` field.

## Limit

- Only sync last 1000 memos.
- if memo exist, cannot update the content. We don't want to break your content.
- Only can fetch/send text content(markdown part).

## ScreenShot

![](docs/memos.png)

![](docs/logseq.png)

## Thanks

- [Memos](https://github.com/usememos/memos)

## Contributors

<p align="center">
    <a href="https://github.com/eindex/logseq-memos-sync/graphs/contributors">
        <img src="https://contrib.rocks/image?repo=eindex/logseq-memos-sync"/></a>
</p>

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=eindex/logseq-memos-sync&type=Date)](https://star-history.com/#eindex/logseq-memos-sync&Date)


## Self Checking

If you found data is not sync, please checking belows things:

- Your memos server is reachable.
- The property `memo-id` is not using, this can check by query: `{{query (or (property memoid ) (property memo-id ))}}`

