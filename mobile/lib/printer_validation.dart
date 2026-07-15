const niimbotM2HModelId = 4608;

bool looksLikeM2HDeviceName(String? name) {
  if (name == null) return false;
  final normalized = name.toUpperCase().replaceAll(RegExp(r'[^A-Z0-9]'), '');
  return normalized.startsWith('M2H') || normalized == 'M2';
}

bool isSupportedM2H({required int? modelId, required String? deviceName}) {
  if (modelId != null) return modelId == niimbotM2HModelId;
  return looksLikeM2HDeviceName(deviceName);
}
