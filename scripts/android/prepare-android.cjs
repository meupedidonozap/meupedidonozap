const fs = require('node:fs');
const path = require('node:path');

function prepareAndroid(root) {
  const android = path.join(root, 'android/app/src/main');
  const manifestPath = path.join(android, 'AndroidManifest.xml');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('Adicione o Android primeiro: npx cap add android');
  }
  const permissions = ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION', 'READ_CONTACTS'];
  let manifest = fs.readFileSync(manifestPath, 'utf8');
  for (const permission of permissions) {
    if (!manifest.includes(`android.permission.${permission}`)) {
      manifest = manifest.replace('</manifest>', `    <uses-permission android:name="android.permission.${permission}" />\n</manifest>`);
    }
  }
  // Deliberately do not request WRITE_CONTACTS, background location or broad storage access.
  const packagePath = 'app/lovable/dfc9e1d2017c4c4499328af8ac12f08f';
  const javaDir = path.join(android, 'java', packagePath);
  const activityPath = path.join(javaDir, 'MainActivity.java');
  if (!fs.existsSync(activityPath)) throw new Error('MainActivity.java não encontrado no app Android do MPZ.');
  let activity = fs.readFileSync(activityPath, 'utf8');
  if (!activity.includes('registerPlugin(MpzAndroidPlugin.class)')) {
    if (/void\s+onCreate\s*\(/.test(activity)) {
      if (!activity.includes('super.onCreate(savedInstanceState);')) {
        throw new Error('MainActivity personalizada: registre MpzAndroidPlugin antes de super.onCreate.');
      }
      activity = activity.replace('super.onCreate(savedInstanceState);', 'registerPlugin(MpzAndroidPlugin.class);\n        super.onCreate(savedInstanceState);');
    } else {
      const declaration = /public class MainActivity extends BridgeActivity\s*\{/;
      if (!declaration.test(activity)) throw new Error('MainActivity personalizada: registre MpzAndroidPlugin em onCreate.');
      activity = activity.replace(declaration, `$&\n    @Override\n    public void onCreate(android.os.Bundle savedInstanceState) {\n        registerPlugin(MpzAndroidPlugin.class);\n        super.onCreate(savedInstanceState);\n    }\n`);
    }
  }
  const source = path.join(root, 'scripts/android/MpzAndroidPlugin.java');
  if (!fs.existsSync(source)) throw new Error('Falta scripts/android/MpzAndroidPlugin.java. Atualize o projeto completo.');
  // Validate before writing; keep existing native customization and never replace MainActivity wholesale.
  fs.writeFileSync(manifestPath, manifest);
  fs.writeFileSync(activityPath, activity);
  fs.copyFileSync(source, path.join(javaDir, 'MpzAndroidPlugin.java'));
}

module.exports = { prepareAndroid };
if (require.main === module) {
  try {
    prepareAndroid(path.resolve(__dirname, '../..'));
    console.log('PDF, contatos (leitura) e localização preparados. Execute npx cap sync android e gere o novo APK.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}