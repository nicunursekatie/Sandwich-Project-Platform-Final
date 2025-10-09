#!/bin/bash
echo "Installing packages for development..."
cd /home/runner/workspace
/home/runner/.nix-profile/bin/npm install
echo "Packages installed successfully"