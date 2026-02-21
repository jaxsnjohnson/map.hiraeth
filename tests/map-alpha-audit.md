# Map alpha audit

Use this check before release when map assets change.

## Audit command

```bash
for f in maps/*.webp; do
  sips -g hasAlpha -g pixelWidth -g pixelHeight "$f"
done
```

## Release rule

- If a currently referenced map image reports `hasAlpha: yes`, treat it as a release blocker unless:
  - the alpha is intentional, and
  - the map JSON includes a matching `backgroundColor` value to define the opaque base.

## Fix command pattern

Use ImageMagick to flatten alpha onto an opaque base:

```bash
magick <input.webp> -background "#050510" -alpha remove -alpha off -quality 100 <output.webp>
```
