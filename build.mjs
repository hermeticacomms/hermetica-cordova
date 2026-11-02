import { build } from 'esbuild';

// The Cordova plugin's js-module (plugin.xml): CommonJS, which Cordova exposes as window.HermeticaCordova.
await build({ entryPoints: ['src/index.ts'], bundle: true, minify: true, target: 'es2020', format: 'cjs', outfile: 'www/hermetica-cordova.js' });
