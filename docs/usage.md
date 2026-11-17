# Troubleshooting and limits

## No items found

Open **To-dos**, choose **Pick a to-do** in the exporter, and click a task's text. The green outline shows the detected card. Press **Escape** to cancel picking.

If that fails, choose **Download page structure**. The diagnostic contains element tags, classes, roles, and basic test labels, without message text, links, input values, or account IDs. It can help update the scraper for a changed Slack layout. Nothing is sent automatically.

If the panel never opens, check that the bookmark URL starts with `javascript:` and that your browser allows bookmarklets. The setup page includes a copyable bookmark URL and the source code for review.

## Capture scope

- Export each workspace separately. **Saved** and the older **Later** view can also be captured. For older layouts, export each tab separately.
- Download and close the panel before changing views or filters. Route and tab changes stop capture; some filter changes cannot be detected.
- Keep the Slack tab open while collecting. You can stop early or scroll manually to capture more items.
- Compare the count with Slack and check a few message links. Reaching the bottom does not prove every item was exported.
- Refreshing or closing the tab clears the capture. Keep personal downloads outside the repository.

## Missing details

Only loaded items your account can access are available. Deleted messages, retention limits, collapsed text, and unsupported layouts can leave gaps. Custom tasks may have no sender or original message link. Missing values are `null` in JSON and include a warning.

Dates and reminder text reflect what Slack exposes. Images are not transcribed; files are links, not downloads, and links may expire. Thread replies and reactions are not exported as a complete conversation. Identical custom tasks without stable IDs may be merged.

**Exclude items visibly marked complete** filters downloads without removing collected items. Tasks with unknown status stay included. Use Slack's **In-progress** filter for a strict unfinished-only export.

Slack's [To-dos and Saved views](https://slack.com/help/articles/55757634348435-Later-is-now-To-dos) contain different items. The old public [`stars.list` API](https://docs.slack.dev/reference/methods/stars.list/) does not return modern saved items.
