# Archived Components

This folder contains deprecated components that are no longer in use but kept for reference.

## Components in this folder:

### user-permissions-dialog-deprecated.tsx
- **Status**: DEPRECATED (August 2025)
- **Replaced by**: `enhanced-permissions-dialog.tsx`
- **Reason**: Enhanced UI with role presets and better permission categorization
- **Usage**: DO NOT USE - This component is archived for reference only

The enhanced permissions dialog provides:
- Role preset cards with visual indicators
- Better permission organization by category
- Improved user experience with tabbed interface
- Dangerous permission warnings
- Search functionality for permissions

## Migration Notes
- All references to `user-permissions-dialog` have been updated to use `enhanced-permissions-dialog`
- The Core Team role has been added to the role presets
- Permission structure remains compatible between both components