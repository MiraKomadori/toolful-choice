# Toolful Choice - Tool Ability Selector

A FoundryVTT v13 module for the **dnd5e 5.3.0** system that lets players choose which ability score to use for tool checks.

## What it does

When a player clicks on a tool (e.g. Thieves' Tools, Mason's Tools), instead of automatically rolling with the tool's default ability score, a dialog appears with all six abilities:

```
 STR (+5)    DEX (+7)    CON (+3)
 INT (+1)    WIS (+4)    CHA (+0)

             Cancel
```

Each button shows the **total modifier** (ability mod + tool proficiency + bonuses). After choosing, the roll proceeds normally with all proficiencies, feats, and bonuses applied.

The chosen ability is displayed in the chat message (e.g. *"Thieves' Tools Check (Strength)"*).

## Advantage & Disadvantage

Hold modifier keys while clicking an ability button:

- **Advantage**: Hold the configured advantage key (default: `Alt`)
- **Disadvantage**: Hold the configured disadvantage key (default: `Ctrl`)

The key hints are shown in the dialog and automatically read from your Foundry keybinding configuration.

## Compatibility

| Module / System | Status | Notes |
|---|---|---|
| dnd5e 5.3.0 | Supported | Primary target |
| FoundryVTT v13 | Supported | Required |
| MidiQOL | Compatible | Rolls go through the full MidiQOL workflow |
| Argon Combat HUD (DnD5e) | Compatible | Tool clicks from the HUD are intercepted |
| Other modules using `actor.rollToolCheck()` | Compatible | Standard dnd5e hooks are used |

## What does NOT work / Limitations

- **Non-tool ability checks**: The module only intercepts tool checks. Regular ability checks, saving throws, skill checks, and attack rolls are not affected.
- **Tool bonus formulas**: If a tool has a non-numeric bonus (e.g. `1d4` from Guidance), the dialog total only shows the fixed numeric portion. The full formula is still applied in the actual roll.
- **Global check bonus formulas**: Same as above - only the numeric part is shown in the preview, but the full bonus applies to the roll.
- **Automated rolls**: If another module triggers a tool check without going through the standard dnd5e hooks, the dialog will not appear.

## Installation

### Manual (local)

1. Copy the `toolful-choice` folder into your FoundryVTT `Data/modules/` directory.
2. Restart FoundryVTT (or reload).
3. In your world, go to **Game Settings > Manage Modules** and enable **Toolful Choice**.

### Via Manifest URL

Use the following URL in Foundry's **Install Module > Manifest URL** field:

```
https://github.com/MiraKomadori/toolful-choice/releases/latest/download/module.json
```

## Author

**MiraKomadori**

## License

MIT
