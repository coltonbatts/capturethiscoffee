"use client";

const NIIMBOT_BLE_SERVICE = "e7810a71-73ae-499d-8c15-faa9aef0c3f2";
const NIIMBOT_BLE_CHARACTERISTIC = "bef8d6c9-9c21-4c9e-b632-bd58c1009f9f";

type BluetoothRemoteGATTCharacteristicLike = {
  uuid: string;
  properties?: {
    notify?: boolean;
    writeWithoutResponse?: boolean;
    write?: boolean;
  };
};

type BluetoothRemoteGATTServerLike = {
  connected: boolean;
  connect(): Promise<BluetoothRemoteGATTServerLike>;
  getPrimaryService(
    service: string,
  ): Promise<{
    getCharacteristic(
      characteristic: string,
    ): Promise<BluetoothRemoteGATTCharacteristicLike>;
  }>;
};

type BluetoothDeviceLike = {
  name?: string;
  id?: string;
  gatt?: BluetoothRemoteGATTServerLike;
  addEventListener?: (
    type: "gattserverdisconnected",
    listener: () => void,
  ) => void;
  removeEventListener?: (
    type: "gattserverdisconnected",
    listener: () => void,
  ) => void;
};

type NavigatorWithBluetooth = Navigator & {
  bluetooth?: {
    requestDevice(options: {
      acceptAllDevices: true;
      optionalServices: string[];
    }): Promise<BluetoothDeviceLike>;
  };
};

export type NiimbotProbeResult = {
  ok: boolean;
  message: string;
  deviceName?: string;
  characteristicUuid?: string;
};

export type NiimbotConnection = {
  device: BluetoothDeviceLike;
  deviceName: string;
  characteristicUuid: string;
};

export function isWebBluetoothAvailable() {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

export async function connectNiimbotBluetooth(): Promise<NiimbotConnection> {
  const bluetooth = (navigator as NavigatorWithBluetooth).bluetooth;

  if (!bluetooth) {
    throw new Error(
      "Web Bluetooth is not available in this browser. Use Chrome or Edge on desktop/Android, or keep using browser print.",
    );
  }

  const device = await bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [NIIMBOT_BLE_SERVICE],
  });

  if (!device.gatt) {
    throw new Error("The selected device does not expose a Bluetooth GATT server.");
  }

  const server = await device.gatt.connect();
  const service = await server.getPrimaryService(NIIMBOT_BLE_SERVICE);
  const characteristic = await service.getCharacteristic(
    NIIMBOT_BLE_CHARACTERISTIC,
  );

  return {
    device,
    deviceName: device.name || "Unnamed device",
    characteristicUuid: characteristic.uuid,
  };
}

export async function probeNiimbotBluetooth(): Promise<NiimbotProbeResult> {
  try {
    const connection = await connectNiimbotBluetooth();
    return {
      ok: true,
      deviceName: connection.deviceName,
      characteristicUuid: connection.characteristicUuid,
      message:
        "Connected and found the common NIIMBOT BLE print characteristic. Next step is sending a harmless status command or SDK sample print.",
    };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : "Could not connect to the printer over Web Bluetooth.",
    };
  }
}
