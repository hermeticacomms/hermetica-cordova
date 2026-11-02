// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCordovaClient, type FirebasePlugin } from './index.ts';

afterEach(() => vi.unstubAllGlobals());

function fakeFirebase(granted: boolean) {
  let onMessage: (m: Record<string, unknown>) => void = () => undefined;
  const fb: FirebasePlugin = {
    hasPermission: (ok) => ok(granted),
    grantPermission: (ok) => ok(true),
    getToken: (ok) => ok('fcm-1'),
    onTokenRefresh: () => undefined,
    onMessageReceived: (ok) => { onMessage = ok; },
  };
  return { fb, message: (m: Record<string, unknown>) => onMessage(m) };
}

describe('createCordovaClient', () => {
  it('registers the FCM token with the platform cordova-plugin-device reports', async () => {
    const f = vi.fn(async () => new Response('{}'));
    vi.stubGlobal('fetch', f);
    const { fb } = fakeFirebase(true);
    await createCordovaClient({ siteKey: 'pk', endpoint: 'https://api.test', consentMode: 'none', inApp: false, firebase: fb, cordovaDevice: { platform: 'iOS', model: 'iPhone15,2', version: '17.4' } });
    await vi.waitFor(() => expect(f).toHaveBeenCalled());
    const [url, init] = (f.mock.calls as unknown as [string, RequestInit][])[0]!;
    expect(url).toContain('/client/push-tokens');
    const a = JSON.parse(init.body as string).data.attributes;
    expect(a).toMatchObject({ token: 'fcm-1', vendor: 'fcm', platform: 'ios', enablement_status: 'AUTHORIZED' });
    expect(a.device_metadata).toMatchObject({ device_model: 'iPhone15,2', os_version: '17.4', sdk_version: 'cordova-0.1' });
  });

  it('tracks tapped notifications as opens and the rest as deliveries', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')));
    const { fb, message } = fakeFirebase(false);
    const hm = await createCordovaClient({ siteKey: 'pk', endpoint: 'https://api.test', consentMode: 'none', inApp: false, firebase: fb, cordovaDevice: { platform: 'Android' } });
    message({ hermetica_message_id: 'm1' });
    message({ hermetica_message_id: 'm1', tap: 'background' });
    expect(hm.debug.events().map((e) => e.name)).toEqual(['$received_push', '$opened_push']);
  });
});
