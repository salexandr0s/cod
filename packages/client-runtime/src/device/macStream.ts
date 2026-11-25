// @effect-diagnostics globalFetch:off globalTimers:off - Device frames are consumed by a browser or WebView.
import { msg } from "gt-i18n";
import type { MFunctionType } from "gt-i18n/types";
import type { DeviceFrameSink } from "./frame.ts";
import { withDeviceHubQuery } from "./hubAccess.ts";
import type { DeviceStreamClient, DeviceStreamEvents, DeviceStreamTarget } from "./stream.ts";

export function createMacStream(
  target: DeviceStreamTarget,
  sink: DeviceFrameSink,
  events: DeviceStreamEvents,
  resolve: MFunctionType,
): DeviceStreamClient {
  let controller: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    controller?.abort();
    controller = null;
    clearTimeout(timer);
  };
  const start = () => {
    if (controller) return;
    const current = new AbortController();
    controller = current;
    let previous: string | null = null;
    let width = 0;
    let height = 0;
    events.onStatus("connecting");
    const next = async () => {
      try {
        const params = new URLSearchParams({ device: target.deviceId });
        if (previous) params.set("since", previous);
        const url = withDeviceHubQuery(
          target.access.httpBase + "/mac/frame?" + params,
          target.access,
        );
        const response = await fetch(url, {
          signal: AbortSignal.any([current.signal, AbortSignal.timeout(15000)]),
          credentials: target.access.credentials ? "include" : "same-origin",
        });
        if (current.signal.aborted) return;
        if (response.status === 401) {
          stop();
          events.onUnauthorized();
          return;
        }
        if (!response.ok) throw new Error();
        if (response.status !== 204) {
          const frame = await createImageBitmap(await response.blob());
          try {
            if (current.signal.aborted) return;
            if (!sink.present(frame, frame.width, frame.height)) throw new Error();
            if (width !== frame.width || height !== frame.height) {
              width = frame.width;
              height = frame.height;
              events.onScreen({
                width,
                height,
                orientation: width >= height ? "landscape_right" : "portrait",
              });
            }
          } finally {
            frame.close();
          }
          if (!previous) events.onStatus("streaming");
          previous = response.headers.get("ETag");
        }
        timer = setTimeout(() => void next(), 500);
      } catch {
        if (current.signal.aborted) return;
        stop();
        events.onStatus(
          "error",
          resolve(msg("Mac guest disconnected. Open Mac again to continue.")),
        );
      }
    };
    void next();
  };
  const noop = () => {};
  return {
    start,
    stop,
    setMjpegImage: noop,
    sendTouch: noop,
    sendRawTouch: noop,
    sendKey: noop,
    sendText: noop,
    pressButton: noop,
    rotate: noop,
    setOrientation: noop,
    controlDuo: noop,
    setDuoPanels: noop,
  };
}
