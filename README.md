# @hermeticacomms/sdk-cordova

Hermetica for Cordova apps. The browser SDK runs unchanged in the WebView (consent gate, batching, retries with one
`Idempotency-Key` per batch); this package adds the FCM token from
[cordova-plugin-firebasex](https://github.com/dpa99c/cordova-plugin-firebasex), push open tracking, and in-app messages for the
app's platform. Device details come from cordova-plugin-device.

```sh
cordova plugin add cordova-plugin-firebasex cordova-plugin-device @hermeticacomms/sdk-cordova
```

```js
// after the plugin is installed, also available as window.HermeticaCordova
const hm = await HermeticaCordova.createCordovaClient({
  siteKey: 'hm_pk_...', endpoint: 'https://api.example.com',
  onDeepLink: (link) => router.navigate(link),
});
hm.consent.update({ analytics: true, marketing: true });
hm.identify('user-42', { email: 'ada@example.com' });
hm.screen('Cart');
hm.track('add_to_cart', { sku: 'A1' }, { value: 1999, currency: 'USD' });
await hm.enablePush(); // asks for permission if needed, registers the FCM token
```

- Resolves after `deviceready`. Token refreshes are sent again; the token follows `identify`, `setProfile` and `reset`.
- Tapped notifications track `$opened_push` and go to `onDeepLink`; others track `$received_push`.
- In-app messages show on start, `screen` and `track` (`inApp: false` turns them off).
- Pass `firebase` / `cordovaDevice` to use other plugins with the same shape.
