// Removes the alpha channel from simulator screenshots for App Store upload.

import 'dart:io';

import 'package:image/image.dart' as img;

void main(List<String> paths) {
  if (paths.isEmpty) {
    stderr.writeln('Pass one or more PNG paths.');
    exitCode = 64;
    return;
  }

  for (final path in paths) {
    final file = File(path);
    final source = img.decodePng(file.readAsBytesSync());
    if (source == null) {
      stderr.writeln('Could not decode $path');
      exitCode = 65;
      continue;
    }

    final flattened = img.Image(
      width: source.width,
      height: source.height,
      numChannels: 3,
    );
    for (final pixel in source) {
      final alpha = pixel.a / 255;
      flattened.setPixelRgb(
        pixel.x,
        pixel.y,
        (pixel.r * alpha) + (255 * (1 - alpha)),
        (pixel.g * alpha) + (255 * (1 - alpha)),
        (pixel.b * alpha) + (255 * (1 - alpha)),
      );
    }

    file.writeAsBytesSync(img.encodePng(flattened, level: 9));
    stdout.writeln('Flattened $path');
  }
}
