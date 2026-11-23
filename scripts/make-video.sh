#!/bin/sh
# Builds demo/dani-g2-demo.mp4 from demo/steps (made by scripts/demo.mjs). Needs ffmpeg and jq.
# Silent, captioned. Record a voice-over on top of it if you want narration (demo/narration.md).
set -e
cd "$(dirname "$0")/.."
FONT=${FONT:-/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf}
mkdir -p demo/clips
: > demo/clips/list.txt
i=0
for row in $(jq -r ".[] | @base64" demo/steps.json); do
  f=$(echo "$row" | base64 -d | jq -r .file)
  cap=$(echo "$row" | base64 -d | jq -r .caption)
  hold=$(echo "$row" | base64 -d | jq -r .hold)
  i=$((i+1))
  printf '%s' "$cap" > demo/clips/cap$i.txt
  ffmpeg -y -loglevel error -f lavfi -i color=c=black:s=1280x720:d="$hold" -loop 1 -t "$hold" -i "demo/steps/$f" \
    -filter_complex "[1:v]scale=1152:576:flags=neighbor[g];[0:v][g]overlay=64:40:format=auto,drawbox=x=60:y=36:w=1160:h=584:color=0x1a3a1a:t=3,drawtext=fontfile=$FONT:textfile=demo/clips/cap$i.txt:fontcolor=white:fontsize=25:x=(w-text_w)/2:y=650,format=yuv420p" \
    -r 30 -c:v libx264 -pix_fmt yuv420p "demo/clips/c$i.mp4"
  echo "file 'c$i.mp4'" >> demo/clips/list.txt
done
ffmpeg -y -loglevel error -f concat -safe 0 -i demo/clips/list.txt -c copy demo/dani-g2-demo.mp4
rm -rf demo/clips
echo "wrote demo/dani-g2-demo.mp4"
