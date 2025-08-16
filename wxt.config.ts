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
      "storage",
    ],
    commands: {
      addTabs: {
        suggested_key: {
          default: "Alt+Shift+A"
        },
        description: 'Add current tabs to bucket',
      },
      viewBuckets: {
        suggested_key: {
          default: "Alt+Shift+S"
        },
        description: 'View Buckets',
      },
    }
  },
  modules: ['@wxt-dev/module-react'],
});
