// SPDX-License-Identifier: GPL-3.0-or-later
export const presets = {
  inspect: { label: 'Inspect a font', description: 'Read the font’s internal name and save an editable FontForge source file.', outputs: '/work/font.sfd', script: 'Open($1);\nPrint("Font name: " + $fontname);\nSave("/work/font.sfd");\nPrint("Saved FontForge source.");' },
  export: { label: 'Export two formats', description: 'Open the font once and generate both OTF and WOFF2.', outputs: '/work/font.otf\n/work/font.woff2', script: 'Open($1);\nGenerate("/work/font.otf");\nPrint("OTF ready.");\nGenerate("/work/font.woff2");\nPrint("WOFF2 ready.");' },
  rename: { label: 'Change font names', description: 'Edit the font’s internal names and save the result as SFD.', outputs: '/work/renamed.sfd', script: 'Open($1);\nSetFontNames("Playground-Regular", "Playground", "Playground Regular");\nPrint("New name: " + $fontname);\nSave("/work/renamed.sfd");' },
};
