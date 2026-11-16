# Demo media

These assets show the deployed application from the supplied phone recording.
The original recording was read only and is not included in the repository.

- `demo.webp`: 360 x 600, approximately 14 seconds, infinite loop, no audio.
  Source intervals, in seconds: [22.5, 28.5), [30, 32), [37, 40), [52, 55).
  Exported with ffmpeg at 6 frames per second and WebP quality 65.
- `upload.png`: selected photo and the analysis action.
- `detected.png`: detected product card and confidence.
- `review.png`: user-entered quantity and price.
- `inventory.png`: saved product in the inventory list.

The exports crop the 1170 x 2340 source to 1170 x 1950 at (0, 150),
then scale to 360 x 600. Browser address bars are excluded. The photo picker
around 15-22 seconds is excluded entirely. All 84 frames supplied to the
animation encoder were visually inspected for personal data; the PNGs are
copies of inspected frames 7, 38, 66 and 75. WebP combines duplicate frames
while preserving timing, resulting in 66 encoded frames. No personal data
was observed in the retained frames. Product names and entered inventory
quantities and prices remain visible as part of the demo.
