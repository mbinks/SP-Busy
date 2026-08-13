# BusyBar Status Sync - Super Productivity Plugin

Automatically sync your SuperProductivity task timer status with BusyBar. When you start a task, your BusyBar status updates to "busy"; when you stop, it changes to "available". Perfect for keeping your team informed about your availability.

## Installation

1. Download `sp-plugin.zip` from the [latest release](https://github.com/mbinks/SP-Busy/releases)
2. In Super Productivity: **Settings > Plugins > Upload Plugin**
3. Select the ZIP file
4. "BusyBar Status Sync" appears in the left sidebar

## Setup

1. Click **BusyBar Status Sync** in the sidebar
2. Go to the **Settings** tab
3. Enter your **BusyBar API Token** (Get from your BusyBar account settings)
4. Optionally customize the default BusyBar URL (defaults to `https://api.busy.app/busybar`)
5. Click **Test Connection** to verify
6. Click **Save Settings**

## Features

### Automatic Status Updates
- **Task Started** → BusyBar status set to `busy` with emoji and task title
- **Task Stopped** → BusyBar status set to `available`
- **All Tasks Done** → Custom status (configurable)
- **Day Ended** → Custom status (configurable)

### Custom Rules
Create rules to customize status updates based on:
- Specific projects
- Specific tags
- Timer thresholds (e.g., after 25 minutes of work)
- Idle time

### Tabs

| Tab | Purpose |
|-----|---------|
| **Status** | View and manually update your current BusyBar status |
| **Rules** | Create/edit/toggle automation rules for custom status updates |
| **Settings** | Configure BusyBar API token and connection |

## Example Rules

| Name | Trigger | Status | Emoji | Message |
|------|---------|--------|-------|---------|
| Deep Focus | Task Started (tag: deep-work) | `busy` | 🎯 | Working on: {title} |
| Break Time | Timer: 25 min | `break` | ☕ | Taking a break |
| Available | Task Stopped | `available` | ✅ | Back online |
| Done for Today | All Today's Done | `available` | 🎉 | Done for the day! |

## How It Works

- **plugin.js** (background, survives navigation):
  - Stores BusyBar API token securely via `setSecret`/`getSecret`
  - Handles all authenticated BusyBar API calls
  - Runs the rules engine and hooks
  - Exposes `window.busybarBridge` for the iframe
  
- **index.html** (iframe UI, destroyed on navigation):
  - Pure UI — status display, rules editor, settings
  - Communicates with plugin.js via `window.parent.busybarBridge`
  - Never directly handles credentials

- **Hooks** fire non-blocking (via `setTimeout`) to avoid timeout issues
- **Timer/Idle** rules use background intervals in plugin.js
- **Config** persists via `persistDataSynced`, token via `setSecret` (never synced)

## Security

- BusyBar API token stored via `PluginAPI.setSecret()` — **never in synced/exported data**
- `setSecret`/`getSecret` only available from plugin.js (not iframe)
- Iframe never directly handles credentials
- Old configs with embedded tokens auto-migrate to secret storage

## Requirements

- Super Productivity v10+ (Electron desktop app)
- BusyBar account with API access
- Internet connection to reach BusyBar API

## API Reference

### BusyBar Status Values
- `busy` - You're actively working
- `available` - You're available for interruption
- `break` - Taking a break
- `offline` - Not available
- Custom status values supported

### Status Update Payload
```json
{
  "status": "busy",
  "emoji": "🎯",
  "message": "Working on: Task Title"
}
```

## Troubleshooting

**Connection Failed?**
- Verify your BusyBar API token is correct
- Check that BusyBar API is accessible from your network
- Try the "Test Connection" button in Settings

**Status Not Updating?**
- Make sure the plugin is enabled
- Check that your rules are enabled
- Review the browser console for error logs (F12 in Super Productivity)

**Token Lost After Sync?**
- Tokens stored via `setSecret()` are local-only and don't sync across devices
- Re-enter your token on each device

## Version History

- **1.0** — Initial release: BusyBar API integration with automatic status updates and rules engine

## Credits

Built as a fork of [ha-super-productivity](https://github.com/jloops412/ha-super-productivity) by jloops412, adapted for BusyBar integration.
