# Milestone — Build 6 holographic first print

**Date:** July 24, 2026  
**Recorded from:** Account-owner report and supplied photo  
**Result:** Passed on the first try

Capture This iOS build 6 produced its first physical print after the
holographic label stock was loaded for the first time. The owner selected a
reprint, the app connected directly to the NIIMBOT M2_H over Bluetooth LE, and
the label printed successfully on the first attempt.

The printer was not connected to a laptop, USB cable, local print station,
official NIIMBOT app, or any other printing bridge. This is the intended
production architecture working in the real world:

**Capture This build 6 on iPhone → Bluetooth LE → NIIMBOT M2_H → holographic
Capture This Coffee label.**

The physical result is legible, aligned, and visibly uses the intended
holographic brand stock.

> **Photo held locally, deliberately not committed.**
>
> The evidence image `evidence/2026-07-24-build-6-holographic-first-print.jpg`
> shows the printed label legibly — a person's full name, their drink, and a
> client/production line. This repository is public, and the project rule in
> `README.md` forbids real client data in Git. `docs/milestones/evidence/` is
> therefore gitignored: the photo stays on the account owner's machine and must
> be copied by hand if it is needed elsewhere.
>
> It is a metadata-stripped copy of the supplied `IMG_4723.HEIC`, so no EXIF or
> location data survives. Its SHA-256 is
> `0ef8b8a05a6d34d2a0eeca37e644bbb6aedc7d8d0d67b71536e06cebd3c32c5d`, which
> identifies the held copy if the record ever needs to be matched to the file.
>
> A redacted version could be committed later if public evidence is wanted.

## Why this matters

This is the first recorded proof that the release-candidate iOS build and the
final branded stock work together through the phone-only direct-Bluetooth
path. It closes the central technical uncertainty behind the product: a real
Capture This label can go from the custom iOS app to the physical printer
without a computer or secondary printing app.

## Evidence boundary

This milestone proves one confirmed physical reprint on holographic stock. It
does not by itself complete the full physical release gate. Exact stock
measurements, queue-to-web synchronization, a 10-label batch, interruption
recovery, reconnect/resume behavior, cold-cup adhesion, and Luke's independent
operator run still need to be recorded in
[`../physical-release-test.md`](../physical-release-test.md).
