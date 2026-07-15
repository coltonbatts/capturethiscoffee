import 'package:ctc_printer/printer_validation.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('accepts the M2_H model id', () {
    expect(
      isSupportedM2H(modelId: niimbotM2HModelId, deviceName: 'M2_H-1234'),
      isTrue,
    );
  });

  test('rejects a known non-M2 model regardless of its name', () {
    expect(isSupportedM2H(modelId: 4864, deviceName: 'M2_H'), isFalse);
  });

  test('uses a normalized M2_H name only when model id is unavailable', () {
    expect(isSupportedM2H(modelId: null, deviceName: 'M2_H-1234'), isTrue);
    expect(isSupportedM2H(modelId: null, deviceName: 'M2-H'), isTrue);
    expect(isSupportedM2H(modelId: null, deviceName: 'B1'), isFalse);
  });
}
