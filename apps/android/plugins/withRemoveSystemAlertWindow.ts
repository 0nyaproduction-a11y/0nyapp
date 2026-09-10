import { withAndroidManifest } from 'expo/config-plugins';

const withRemoveSystemAlertWindow = (config: any) => {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const permissions = manifest['uses-permission'];

    if (Array.isArray(permissions)) {
      manifest['uses-permission'] = permissions.filter(
        (perm: any) => perm.$?.['android:name'] !== 'android.permission.SYSTEM_ALERT_WINDOW'
      );
    }

    return config;
  });
};

export default withRemoveSystemAlertWindow;
