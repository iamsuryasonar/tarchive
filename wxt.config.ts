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
      "https://*/*"
    ],
    permissions: [
      "tabs",
      "storage"
    ],
  },
  modules: ['@wxt-dev/module-react'],
});
