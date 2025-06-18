import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  vite: () => ({
    plugins: [
      tailwindcss(),
    ],
  }),
  manifest: {
    manifest_version: 3,
    name: "Tarchive",
    description: "archive tabs",
    version: "1.0",
    action: {
      "default_popup": "popup.html",
      "default_icon": "icon/logo.png"
    },
    host_permissions: [
      "http://*/*",
      "https://*/*",
      "<all_urls>"
    ],
    permissions: [
      "tabs",
      "tabGroups",
    ],
    commands: {
      "add-tabs": {
        suggested_key: {
          default: "Ctrl+Shift+A"
        },
        description: 'Add current tabs to bucket',
      },
      "view-buckets": {
        suggested_key: {
          default: "Ctrl+Shift+V"
        },
        description: 'View Buckets',
      },
    }
  },
  modules: ['@wxt-dev/module-react'],
});
