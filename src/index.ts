/// <reference lib="dom" />
import { createHybridClient, type AppPushToken, type HybridClient, type HybridOptions } from '@hermeticacomms/sdk-browser';

export type { AppDevice, HybridClient, ProfileIds } from '@hermeticacomms/sdk-browser';

type Fail = (e: unknown) => void;
/** The slice of cordova-plugin-firebasex's `FirebasePlugin` used here. */
export interface FirebasePlugin {
  hasPermission(ok: (granted: boolean) => void, fail?: Fail): void;
  grantPermission(ok: (granted: boolean) => void, fail?: Fail): void;
  getToken(ok: (token: string | null) => void, fail?: Fail): void;
  onTokenRefresh(ok: (token: string) => void, fail?: Fail): void;
  onMessageReceived(ok: (message: Record<string, unknown>) => void, fail?: Fail): void;
}
/** cordova-plugin-device's `window.device`. */
export interface CordovaDevice { platform: string; model?: string; version?: string }

export interface CordovaOptions extends Omit<HybridOptions, 'platform'> {
  /** Defaults to `window.FirebasePlugin` (cordova-plugin-firebasex). Without it, push is off (call `setPushToken` yourself). */
  firebase?: FirebasePlugin;
  /** Defaults to `window.device` (cordova-plugin-device), read after `deviceready`. */
  cordovaDevice?: CordovaDevice;
  requestPushPermission?: boolean;
  pushEnvironment?: 'debug' | 'release';
}
export type CordovaClient = HybridClient & {
  /** Asks for notification permission if needed and registers the FCM token. Resolves whether notifications are allowed. */
  enablePush(): Promise<boolean>;
};

const whenReady = () => new Promise<void>((r) => {
  if ((globalThis as { cordova?: unknown }).cordova === undefined) return r(); // not in Cordova (tests, a browser preview)
  document.addEventListener('deviceready', () => r(), { once: true });
});
const ask = (f: (ok: (v: boolean) => void, fail: Fail) => void) => new Promise<boolean>((r) => f(r, () => r(false)));

/**
 * Hermeticor for Cordova: the browser SDK in the WebView (consent gate, batching, retries with one Idempotency-Key per batch), plus
 * the FCM token from cordova-plugin-firebasex, push open tracking, and in-app messages for ios / android. Resolves after `deviceready`.
 */
export async function createCordovaClient(o: CordovaOptions): Promise<CordovaClient> {
  await whenReady();
  const g = globalThis as { FirebasePlugin?: FirebasePlugin; device?: CordovaDevice };
  const { firebase = g.FirebasePlugin, cordovaDevice = g.device, requestPushPermission = false, pushEnvironment = 'release', ...rest } = o;
  const platform = cordovaDevice?.platform.toLowerCase() === 'ios' ? 'ios' : 'android';
  const device = { ...(cordovaDevice?.model ? { deviceModel: cordovaDevice.model } : {}), osName: platform, ...(cordovaDevice?.version ? { osVersion: cordovaDevice.version } : {}), ...rest.device };
  const hm = createHybridClient({ ...rest, platform, device, sdkVersion: 'cordova-0.1' });
  let allowed = false;
  const send = (token: string | null) => {
    if (!token) return;
    const t: AppPushToken = { token, vendor: 'fcm', environment: pushEnvironment, enablementStatus: allowed ? 'AUTHORIZED' : 'DENIED' };
    void hm.setPushToken(t);
  };

  async function enablePush(): Promise<boolean> {
    if (!firebase) return false;
    allowed = (await ask((ok, fail) => firebase.hasPermission(ok, fail))) || (await ask((ok, fail) => firebase.grantPermission(ok, fail)));
    firebase.getToken(send, () => undefined);
    return allowed;
  }
  if (firebase) {
    firebase.onTokenRefresh(send, () => undefined);
    // firebasex flattens the data into the message and sets `tap` when the user opened it.
    firebase.onMessageReceived((m) => { if (m['tap']) hm.handlePushOpened(m); else hm.handlePushReceived(m); }, () => undefined);
    if (requestPushPermission) void enablePush();
    else void ask((ok, fail) => firebase.hasPermission(ok, fail)).then((yes) => { if (yes) void enablePush(); });
  }
  return { ...hm, enablePush };
}
