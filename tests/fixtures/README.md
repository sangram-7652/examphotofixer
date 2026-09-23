# Test fixtures

Image fixtures for pipeline tests (next phase). Keep each file small (< 200 KB) except
where a test needs a large input — generate huge images in-test instead of committing them.

Planned fixtures (none committed yet):

| File                     | Purpose                                |
| ------------------------ | -------------------------------------- |
| `portrait.jpg`           | 3:4 portrait photo                     |
| `landscape.jpg`          | 4:3 landscape photo                    |
| `square.png`             | 1:1 PNG with alpha channel             |
| `exif-orientation-6.jpg` | Stored landscape, EXIF says rotate 90° |
| `exif-orientation-3.jpg` | Stored upside-down, EXIF says 180°     |
| `truncated.jpg`          | Corrupt JPEG (valid header, cut short) |
| `not-an-image.jpg`       | Text file with a .jpg extension        |

Never commit real people's photos or signatures. Use synthetic or openly licensed images.
