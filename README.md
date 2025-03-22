# Limo Chrome Extension

## Overview
Limo is a Google Chrome extension that allows users to **group tabs(bucket)** and **save them** in local storage for easy access later. Users can create, manage, and reopen saved tab groups(buckets) with a single click.

## Features
- **Group Tabs(bucket)**: Select multiple tabs and save them as a group.
- **Store in Local Storage**: Saves tab groups in `chrome.storage.local` for persistence.
- **Quick Access**: Reopen all tabs from a saved group instantly.
- **Manage Groups**: Delete saved tab groups(bucket).
- **User-Friendly UI**: Simple popup interface to manage groups easily.

## Installation
1. Download or clone this repository.
2. Open **Chrome** and go to `chrome://extensions/`.
3. Enable **Developer mode** (top right corner).
4. Click **Load unpacked** and select the extension folder.
5. The extension is now installed!

## How to Use
1. Click the **Limo** extension icon.
2. Click **"Add"** to create a new tab group(bucket).
3. View saved groups in the extension popup.
4. Click **"Open Group"** to restore saved tabs.
5. Click **"Delete"** to remove a saved group.

## File Structure
```
limo
  │── manifest.json               # Extension configuration
  |── images
        |── logo.png
  |── pages
        │── buckets_page          # bucket page
              │── buckets.js       
              │── buckets.css             
              │── buckets.html            
  |── pop_up                      # pop_up ui and business logic
        │── popup.html   
        │── popup.js  
        │── popup.css      
  │── scripts
        │── background.js         # Listens for tab events
```

## Manifest.json Configuration (Manifest V3)
```json
{
    "name": "limo",
    "description": "store tabs in buckets",
    "version": "1.0",
    "manifest_version": 3,
    "action": {
        "default_popup": "pop_up/pop_up.html",
        "default_icon": "images/logo.png"
    },
    "content_scripts": [
        {
            "matches": [
                "http://*/*",
                "https://*/*"
            ],
            "js": [
                "scripts/content.js"
            ]
        }
    ],
    "background": {
        "service_worker": "scripts/background.js"
    },
    "host_permissions": [
        "http://*/*",
        "https://*/*"
    ],
    "permissions": [
        "tabs",
        "storage"
    ]
}
```

## Future Improvements
- **Sync with Google Account** to store groups across devices.
- **Auto-save session** before closing Chrome.
- **Pomodoro timer** for break notification.
- **Full screen time** as screen saver.
- **Todo list** for productivity and time management.

## License
Do whatever you like!

---
Happy browsing!

