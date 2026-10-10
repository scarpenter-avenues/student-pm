// Bundles the email sender into one file for Apps Script: dist-email/Code.gs (plus its manifest, appsscript.json).
// Apps Script only runs top-level functions, so the bundle is wrapped and each entry point gets a one-line stub.
import { copyFileSync, mkdirSync } from 'node:fs'
import { build } from 'esbuild'

const ENTRY_POINTS = ['sendPending', 'install', 'uninstall', 'sendTestEmail']

mkdirSync('dist-email', { recursive: true })
await build({
  entryPoints: ['scripts/email/appsScript.ts'],
  outfile: 'dist-email/Code.gs',
  bundle: true,
  format: 'iife',
  globalName: 'SwitchbackEmail',
  target: 'es2020',
  banner: {
    js: '// Switchback email sender. Built by `npm run build:email`; edit the sources in scripts/email, not this file.',
  },
  footer: {
    js: ENTRY_POINTS.map((name) => `function ${name}() { return SwitchbackEmail.${name}() }`).join(
      '\n',
    ),
  },
})
copyFileSync('scripts/email/appsscript.json', 'dist-email/appsscript.json')
console.log('Built dist-email/Code.gs and dist-email/appsscript.json')
