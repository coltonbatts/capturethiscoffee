// Decodes barcodes in an image using Apple's Vision framework — the same
// detector the CTC Printer iOS app uses.
//
// Build:
//   swiftc -O tools/vision-barcode/main.swift -o /tmp/vision-barcode
// Usage:
//   /tmp/vision-barcode <image> [image ...]
//
// Accepts anything ImageIO can read, including HEIC and JPEG straight off an
// iPhone. EXIF orientation is read and passed to Vision so photos taken in any
// device orientation are handled correctly.
//
// Prints one JSON object per line:
//   {"file":"...","symbology":"...","payload":"..."}
// A file with no detections prints one line with "symbology":"none".

import Foundation
import Vision
import CoreImage
import ImageIO

let arguments = Array(CommandLine.arguments.dropFirst())
guard !arguments.isEmpty else {
    FileHandle.standardError.write(Data("usage: vision-barcode <image> [image ...]\n".utf8))
    exit(2)
}

func escape(_ value: String) -> String {
    var out = ""
    for character in value.unicodeScalars {
        switch character {
        case "\"": out += "\\\""
        case "\\": out += "\\\\"
        case "\n": out += "\\n"
        case "\r": out += "\\r"
        case "\t": out += "\\t"
        default:
            if character.value < 0x20 {
                out += String(format: "\\u%04x", character.value)
            } else {
                out.unicodeScalars.append(character)
            }
        }
    }
    return out
}

/// EXIF orientation from the file itself; Core Image does not apply it for us.
func exifOrientation(for url: URL) -> CGImagePropertyOrientation {
    guard
        let source = CGImageSourceCreateWithURL(url as CFURL, nil),
        let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil)
            as? [CFString: Any],
        let raw = properties[kCGImagePropertyOrientation] as? UInt32,
        let orientation = CGImagePropertyOrientation(rawValue: raw)
    else {
        return .up
    }
    return orientation
}

var exitCode: Int32 = 0

for path in arguments {
    let url = URL(fileURLWithPath: path)
    guard let image = CIImage(contentsOf: url) else {
        FileHandle.standardError.write(Data("could not load \(path)\n".utf8))
        exitCode = 3
        continue
    }

    let request = VNDetectBarcodesRequest()
    request.symbologies = [.qr, .dataMatrix, .aztec, .pdf417, .code128]

    let handler = VNImageRequestHandler(
        ciImage: image,
        orientation: exifOrientation(for: url),
        options: [:]
    )

    do {
        try handler.perform([request])
    } catch {
        FileHandle.standardError.write(Data("vision failed on \(path): \(error)\n".utf8))
        exitCode = 4
        continue
    }

    let results = request.results ?? []
    if results.isEmpty {
        print("{\"file\":\"\(escape(path))\",\"symbology\":\"none\",\"payload\":\"\"}")
        continue
    }

    for observation in results {
        let symbology = observation.symbology.rawValue
        let payload = observation.payloadStringValue ?? ""
        print(
            "{\"file\":\"\(escape(path))\","
                + "\"symbology\":\"\(escape(symbology))\","
                + "\"payload\":\"\(escape(payload))\"}"
        )
    }
}

exit(exitCode)
