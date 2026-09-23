# Product Requirements — ExamPhotoFixer

**Tagline:** Fix it before you upload.
**Category:** Exam & Application File Tools.
**Market:** India. Mobile-first (most applicants apply from a phone).

## Problem

Online exam and job application forms in India reject photos, signatures and thumb
impressions that miss exact pixel dimensions, file-size windows (KB), format or DPI.
Applicants waste attempts, pay cyber cafés, or upload distorted images that are rejected later.

## Goal (V1)

Let an applicant turn any phone photo or scan into a file that meets the official
requirement on the first try — in the browser, without uploading the file anywhere.

## V1 tools

| #   | Tool                              | Route                           | Presets                 |
| --- | --------------------------------- | ------------------------------- | ----------------------- |
| 1   | CCC Photo Resizer                 | `/ccc-photo-resizer`            | `ccc-photo`             |
| 2   | CCC Signature Resizer             | `/ccc-signature-resizer`        | `ccc-signature`         |
| 3   | CCC Left Thumb Impression Resizer | `/ccc-thumb-impression-resizer` | `ccc-left-thumb`        |
| 4   | CCC Complete Pack                 | `/ccc-image-resizer`            | all three CCC presets   |
| 5   | Generic Image Resizer             | `/image-resizer`                | user-entered dimensions |
| 6   | Generic Image Compressor          | `/image-compressor`             | user-entered KB target  |

## Core user flow

1. Land on a tool page (search or home).
2. Select a file (camera or gallery).
3. Adjust crop (auto crop proposed; never stretched).
4. See a live checklist: ✓ Dimensions ✓ File size ✓ Format ✓ DPI ✓ Ready — or a specific, actionable failure.
5. Download.

## Success criteria

- Output passes every check for its preset (validated in-app and in tests).
- Works on a mid-range Android phone with a 12 MP camera photo.
- Time from landing to download < 60 s for a first-time user.
- No user file ever leaves the device.

## Out of scope for V1

Authentication, database, payments, admin panel, AI features (background removal,
face detection), server-side processing, document/PDF tools, exams other than CCC.

## Non-negotiables

- Requirements are never invented. Every preset carries its source. See [FORM_PRESETS.md](FORM_PRESETS.md).
- No distortion: crop to aspect ratio, then resize uniformly.
- Privacy: local processing only. See [PRIVACY.md](PRIVACY.md).
