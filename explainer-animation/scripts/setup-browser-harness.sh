#!/bin/sh
# Sets up headless Chromium for the render checks on an Arch Linux ARM machine WITHOUT installing
# system packages: unpacks the shared libraries and fonts Chromium needs into a private directory
# and writes a run.sh that launches node with them on the library and font paths.
#
#   sh setup-browser-harness.sh <target-dir>
#   export EXPLAINER_BROWSER_DIR=<target-dir>      # then plain `node scripts/render-check.mjs ...` works
#
# It writes a package.json in <target-dir>, runs `npm install` there (playwright, ffmpeg-static) and
# `npx playwright install chromium` (browser cache: ~/.cache/ms-playwright). See references/checks.md.
# Package versions are read from the mirror's index, so a stale local pacman database does not matter.
set -eu
T=${1:?usage: setup-browser-harness.sh <target-dir>}
M=http://mirror.archlinuxarm.org/aarch64
mkdir -p "$T/syslibs/pkgs" "$T/syslibs/root" "$T/syslibs/fc-cache"
cd "$T/syslibs"
for repo in core extra; do curl -sfL --max-time 90 "$M/$repo/" -o "$repo.html"; done
LIBS="nss nspr at-spi2-core libx11 libxcomposite libxdamage libxext libxfixes libxrandr mesa libxcb libxkbcommon alsa-lib libxau libxdmcp libdrm wayland libxrender libxi libxtst libxshmfence libxxf86vm libglvnd libpciaccess"
FONTS="inter-font ttf-jetbrains-mono ttf-dejavu"
for p in $LIBS $FONTS; do
  found=
  for repo in core extra; do
    f=$(grep -oE "href=\"$p-[0-9][^\"]*-(aarch64|any)\.pkg\.tar\.(xz|zst)\"" "$repo.html" | head -1 | sed 's/href="//;s/"$//')
    if [ -n "$f" ]; then
      curl -sfL --max-time 180 "$M/$repo/$f" -o "pkgs/$p.pkg" && bsdtar -xf "pkgs/$p.pkg" -C root 2>/dev/null && found=1
      break
    fi
  done
  [ -n "$found" ] || echo "warning: could not fetch $p" >&2
done
cat > fonts.conf <<CONF
<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>$T/syslibs/root/usr/share/fonts</dir>
  <cachedir>$T/syslibs/fc-cache</cachedir>
  <alias><family>system-ui</family><prefer><family>Inter</family></prefer></alias>
  <alias><family>sans-serif</family><prefer><family>Inter</family><family>DejaVu Sans</family></prefer></alias>
  <alias><family>ui-monospace</family><prefer><family>JetBrains Mono</family></prefer></alias>
  <alias><family>monospace</family><prefer><family>JetBrains Mono</family><family>DejaVu Sans Mono</family></prefer></alias>
</fontconfig>
CONF
cd "$T"
cat > package.json <<'PKG'
{ "name": "explainer-browser-harness", "private": true, "dependencies": { "playwright": "^1.50.0", "ffmpeg-static": "^5.2.0" } }
PKG
npm install --silent >/dev/null 2>&1
npx playwright install chromium >/dev/null 2>&1
cat > run.sh <<RUN
#!/bin/sh
# Runs a node script with the private browser libraries and fonts. Changes into this directory
# first, so pass absolute paths for files outside it.
export LD_LIBRARY_PATH=$T/syslibs/root/usr/lib
export FONTCONFIG_FILE=$T/syslibs/fonts.conf
cd $T && exec node "\$@"
RUN
chmod +x run.sh
echo "ready: $T/run.sh"
