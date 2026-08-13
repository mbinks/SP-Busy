#!/bin/bash
# BusyBar Status Sync Plugin Release Script
# This script creates a GitHub release with the compiled plugin

VERSION=${1:-"1.0.0"}
PLUGIN_DIR="sp-plugin"
ZIP_FILE="sp-plugin.zip"

echo "🎯 Creating BusyBar Status Sync v$VERSION release..."

# Create zip file
echo "📦 Creating $ZIP_FILE..."
cd $PLUGIN_DIR
zip -r ../$ZIP_FILE .
cd ..

# Display instructions for manual release creation
echo ""
echo "✅ Plugin zip created: $ZIP_FILE"
echo ""
echo "📝 To create the GitHub release, follow these steps:"
echo ""
echo "1. Go to: https://github.com/mbinks/SP-Busy/releases/new"
echo "2. Click 'Choose a tag' and create new tag: v$VERSION"
echo "3. Set Release title: BusyBar Status Sync v$VERSION"
echo "4. Copy and paste this release notes:"
echo ""
echo "---BEGIN RELEASE NOTES---"
echo "## BusyBar Status Sync v$VERSION"
echo ""
echo "Sync SuperProductivity task timer status with BusyBar. Automatically update your BusyBar status when you start/stop tasks."
echo ""
echo "### Features"
echo "- ✅ Automatic status updates (task start/stop)"
echo "- ✅ Custom automation rules"
echo "- ✅ Timer-based triggers"
echo "- ✅ Idle state monitoring"
echo "- ✅ Secure token storage (never synced)"
echo ""
echo "### Installation"
echo "1. Download \`sp-plugin.zip\` from the Assets section below"
echo "2. In Super Productivity: **Settings > Plugins > Upload Plugin**"
echo "3. Select the ZIP file"
echo "4. Click \"BusyBar Status Sync\" in the sidebar"
echo "5. Go to Settings and enter your BusyBar API token"
echo "6. Click \"Test Connection\" to verify"
echo ""
echo "### Requirements"
echo "- Super Productivity v10+"
echo "- BusyBar account with API access"
echo ""
echo "See [README](https://github.com/mbinks/SP-Busy/blob/main/sp-plugin/README.md) for full documentation."
echo "---END RELEASE NOTES---"
echo ""
echo "5. Upload $ZIP_FILE as an asset"
echo "6. Click 'Publish release'"
echo ""
