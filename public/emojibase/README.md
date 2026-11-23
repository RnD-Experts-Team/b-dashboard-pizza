# Vendored Emojibase data

These files are a verbatim copy of the English dataset from the npm package
`emojibase-data@18.0.0` (MIT licence, see `LICENSE` in this folder):

- `en/data.json`      (from `emojibase-data/en/data.json`)
- `en/messages.json`  (from `emojibase-data/en/messages.json`)

## Why they are here

The `frimousse` emoji picker (used by Announcements) downloads this data at
runtime. By default it fetches it from `https://cdn.jsdelivr.net/npm/emojibase-data@latest`,
which the app's Content-Security-Policy (`connect-src 'self' ...`) blocks. Serving the
same files from our own origin keeps the picker working without loosening the CSP.

## How the picker finds them

frimousse requests `${emojibaseUrl}/${locale}/data.json` and
`${emojibaseUrl}/${locale}/messages.json` (plus a `HEAD` request on each for
the ETag). Pass `emojibaseUrl="/emojibase"` and `locale="en"`:

    <EmojiPicker.Root locale="en" emojibaseUrl="/emojibase" ... />

Only `en` is vendored. A locale that is not vendored will 404, so always pass
`locale="en"` (the picker UI strings come from next-intl, not from this data).

## Updating

Bump together with `frimousse`: `npm pack emojibase-data@<version>`, copy
`en/data.json` and `en/messages.json` over these files and change the version
above. frimousse hides emoji newer than what the user's system can draw, so a
newer dataset is safe.
