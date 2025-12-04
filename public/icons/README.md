# PWA Icons

This directory contains the PWA icons for Video Game Wingman.

## Required Icon Sizes

- 72x72.png
- 96x96.png
- 128x128.png
- 144x144.png
- 152x152.png (iOS)
- 192x192.png
- 384x384.png
- 512x512.png

## Generating Icons

You can generate icons from the existing logo (`/public/video-game-wingman-logo.png`) using:

1. **Online Tools**:

   - https://realfavicongenerator.net/
   - https://www.pwabuilder.com/imageGenerator
   - https://www.appicon.co/

2. **Command Line** (if ImageMagick is installed):

   ```bash
   convert public/video-game-wingman-logo.png -resize 72x72 public/icons/icon-72x72.png
   convert public/video-game-wingman-logo.png -resize 96x96 public/icons/icon-96x96.png
   convert public/video-game-wingman-logo.png -resize 128x128 public/icons/icon-128x128.png
   convert public/video-game-wingman-logo.png -resize 144x144 public/icons/icon-144x144.png
   convert public/video-game-wingman-logo.png -resize 152x152 public/icons/icon-152x152.png
   convert public/video-game-wingman-logo.png -resize 192x192 public/icons/icon-192x192.png
   convert public/video-game-wingman-logo.png -resize 384x384 public/icons/icon-384x384.png
   convert public/video-game-wingman-logo.png -resize 512x512 public/icons/icon-512x512.png
   ```

3. **Node.js Script** (using sharp - already in dependencies):
   Create a script to generate all icons from the logo.

## Icon Requirements

- Format: PNG
- Transparency: Supported (maskable icons)
- Purpose: Should work as both "any" and "maskable"
- Design: Should be recognizable at small sizes (72x72)
- Background: Can be transparent or use brand color (#1a1a2e)

## Temporary Placeholder

For testing purposes, you can use simple colored squares as placeholders, but replace them with proper branded icons before production.
