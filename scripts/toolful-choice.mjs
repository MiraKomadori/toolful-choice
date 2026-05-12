const MODULE_ID = "toolful-choice";

const ABILITIES = [
  { key: "str", label: "Strength", icon: "fas fa-fist-raised" },
  { key: "dex", label: "Dexterity", icon: "fas fa-feather-alt" },
  { key: "con", label: "Constitution", icon: "fas fa-heart" },
  { key: "int", label: "Intelligence", icon: "fas fa-brain" },
  { key: "wis", label: "Wisdom", icon: "fas fa-eye" },
  { key: "cha", label: "Charisma", icon: "fas fa-comment" }
];

let bypassing = false;
let pendingAbility = null;
let pendingAdvantageMode = 0;

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing`);
});

function findActor(...candidates) {
  for (const c of candidates) {
    if (!c) continue;
    if (c instanceof Actor) return c;
    if (c.actor instanceof Actor) return c.actor;
    if (c.parent instanceof Actor) return c.parent;
  }
  return null;
}

function getAdvantageMode(event) {
  if (!event) return 0;

  if (typeof dnd5e?.utils?.areKeysPressed === "function") {
    if (dnd5e.utils.areKeysPressed(event, "skipDialogAdvantage")) return 1;
    if (dnd5e.utils.areKeysPressed(event, "skipDialogDisadvantage")) return -1;
    return 0;
  }

  if (event.altKey) return 1;
  if (event.ctrlKey || event.metaKey) return -1;
  return 0;
}

function getAdvantageKeyHints() {
  try {
    const advBindings = game.keybindings.get("dnd5e", "skipDialogAdvantage");
    const disBindings = game.keybindings.get("dnd5e", "skipDialogDisadvantage");

    const keyName = (bindings) => {
      if (!bindings?.length) return null;
      const parts = [];
      const b = bindings[0];
      if (b.modifiers?.length) parts.push(...b.modifiers.map(m => m.replace("Key", "")));
      if (b.key) parts.push(b.key.replace(/^(Key|Digit)/, "").replace(/Left|Right/, ""));
      return parts.join("+") || null;
    };

    const advKey = keyName(advBindings);
    const disKey = keyName(disBindings);
    if (advKey || disKey) {
      const hints = [];
      if (advKey) hints.push(`${advKey} = Advantage`);
      if (disKey) hints.push(`${disKey} = Disadvantage`);
      return hints.join(" | ");
    }
  } catch (e) {}
  return "Alt = Advantage | Ctrl = Disadvantage";
}

// --- Strategy 1: Activity-level hook (character sheet click) ---
Hooks.on("dnd5e.preUseActivity", (activity, usageConfig, dialogConfig, messageConfig) => {
  if (bypassing) return true;
  if (activity.type !== "check" || activity.item?.type !== "tool") return true;

  console.log(`${MODULE_ID} | Intercepted via preUseActivity`);
  interceptActivityUse(activity, usageConfig, dialogConfig, messageConfig);
  return false;
});

async function interceptActivityUse(activity, usageConfig, dialogConfig, messageConfig) {
  const actor = findActor(activity.actor, activity.item, activity);
  const toolName = activity.item?.name ?? "Tool";
  const toolKey = activity.item?.system?.type?.value ?? activity.item?.system?.toolType ?? null;

  const result = await promptAbilityChoice(actor, toolName, toolKey);
  if (!result) return;

  const originalAbility = activity.check?.associated;

  bypassing = true;
  pendingAdvantageMode = result.advantageMode;
  try {
    if (activity.check) activity.check.associated = result.ability;

    const dialogOpts = foundry.utils.deepClone(dialogConfig ?? {});
    dialogOpts.configure = false;

    await activity.use(usageConfig, dialogOpts, messageConfig);
  } catch (err) {
    console.error(`${MODULE_ID} | Activity re-roll failed`, err);
  } finally {
    if (activity.check && originalAbility !== undefined) {
      activity.check.associated = originalAbility;
    }
    bypassing = false;
    pendingAdvantageMode = 0;
  }
}

// --- Strategy 2: Ability check hook (main path for rollToolCheck / Argon) ---
Hooks.on("dnd5e.preRollAbilityCheck", (config, dialog, message) => {
  if (bypassing) {
    if (pendingAbility) {
      applyAbilityOverride(config, pendingAbility, message);
    }
    if (pendingAdvantageMode !== 0) {
      applyAdvantageMode(config, pendingAdvantageMode);
    }
    return true;
  }

  if (!isToolRelatedRoll(config, message)) return true;

  console.log(`${MODULE_ID} | Intercepted via preRollAbilityCheck`, config);
  interceptToolAbilityRoll(config, dialog, message);
  return false;
});

function isToolRelatedRoll(config, message) {
  if (config?.tool) return true;
  if (config?.data?.tool) return true;
  const subject = config?.subject;
  if (subject?.type === "tool") return true;
  if (subject?.parent?.type === "tool") return true;
  const flavor = message?.data?.flavor ?? message?.flavor ?? "";
  if (/tool\s+check/i.test(flavor)) return true;
  return false;
}

function applyAbilityOverride(config, ability, message) {
  const actor = findActor(config.actor, config.subject, config);
  if (!actor) return;

  const abilityData = actor.system?.abilities?.[ability];
  if (!abilityData) return;

  if (config.data) {
    config.data.mod = abilityData.mod;
    config.data.ability = ability;
    if (config.data.abilities?.[ability]) {
      config.data.defaultAbility = ability;
    }
  }

  if (config.ability !== undefined) config.ability = ability;

  const abilityLabel = CONFIG.DND5E?.abilities?.[ability]?.label ?? ability;
  const localizedLabel = game.i18n.localize(abilityLabel);

  const appendAbility = (text) => {
    if (!text) return text;
    if (text.includes("(")) return text.replace(/\(.*?\)/, `(${localizedLabel})`);
    return `${text} (${localizedLabel})`;
  };

  config.flavor = appendAbility(config.flavor);
  if (config.dialogOptions?.title) {
    config.dialogOptions.title = appendAbility(config.dialogOptions.title);
  }

  if (message) {
    if (message.flavor !== undefined) message.flavor = appendAbility(message.flavor);
    if (message.data?.flavor !== undefined) message.data.flavor = appendAbility(message.data.flavor);
  }
}

function applyAdvantageMode(config, mode) {
  if (mode === 1) {
    config.advantageMode = 1;
    config.advantage = true;
    config.disadvantage = false;
  } else if (mode === -1) {
    config.advantageMode = -1;
    config.advantage = false;
    config.disadvantage = true;
  }

  if (config.rolls?.length) {
    for (const roll of config.rolls) {
      if (roll.options) {
        roll.options.advantageMode = mode;
      }
    }
  }

  console.log(`${MODULE_ID} | Advantage mode: ${mode === 1 ? "Advantage" : "Disadvantage"}`);
}

async function interceptToolAbilityRoll(config, dialog, message) {
  const actor = findActor(config.actor, config.subject, config);
  if (!actor) return;

  const toolKey = config.tool ?? config.data?.tool;
  const toolName = config.item?.name ?? config.subject?.name
    ?? resolveToolName(actor, toolKey) ?? toolKey ?? "Tool";

  const result = await promptAbilityChoice(actor, toolName, toolKey);
  if (!result) return;

  pendingAbility = result.ability;
  pendingAdvantageMode = result.advantageMode;
  bypassing = true;
  try {
    if (toolKey) {
      await actor.rollToolCheck({ tool: toolKey });
    } else {
      await actor.rollToolCheck(config);
    }
  } catch (err) {
    console.error(`${MODULE_ID} | Tool re-roll failed`, err);
  } finally {
    bypassing = false;
    pendingAbility = null;
    pendingAdvantageMode = 0;
  }
}

function resolveToolName(actor, toolKey) {
  if (!actor || !toolKey) return null;
  const toolConfig = CONFIG.DND5E?.tools ?? CONFIG.DND5E?.toolIds ?? {};
  const entry = toolConfig[toolKey];
  if (typeof entry === "string") return game.i18n.localize(entry);
  if (entry?.label) return game.i18n.localize(entry.label);
  return actor.system?.tools?.[toolKey]?.label ?? null;
}

// --- Ability choice dialog ---
function computeToolTotal(actor, abilityKey, toolKey) {
  const abilityMod = actor.system?.abilities?.[abilityKey]?.mod ?? 0;

  let profBonus = 0;
  let toolBonus = 0;
  const toolData = toolKey ? actor.system?.tools?.[toolKey] : null;
  if (toolData) {
    const profValue = actor.system?.attributes?.prof ?? 0;
    const multiplier = toolData.prof?.multiplier ?? toolData.value ?? 0;
    profBonus = Math.floor(multiplier * profValue);
    toolBonus = Number(toolData.bonus) || 0;
  }

  const globalCheck = Number(actor.system?.bonuses?.abilities?.check) || 0;

  return abilityMod + profBonus + toolBonus + globalCheck;
}

async function promptAbilityChoice(actor, toolName, toolKey = null) {
  const abilityScores = actor?.system?.abilities ?? {};
  const keyHints = getAdvantageKeyHints();

  console.log(`${MODULE_ID} | Actor:`, actor?.name, "Tool:", toolKey, "Abilities:", abilityScores);

  const buttons = ABILITIES.map(({ key, label, icon }) => {
    const total = computeToolTotal(actor, key, toolKey);
    const sign = total >= 0 ? "+" : "";
    return {
      action: key,
      label: `${label} (${sign}${total})`,
      icon,
      callback: (event) => ({ ability: key, advantageMode: getAdvantageMode(event) })
    };
  });

  buttons.push({
    action: "cancel",
    label: "Cancel",
    icon: "fas fa-times",
    callback: () => null
  });

  try {
    const result = await foundry.applications.api.DialogV2.wait({
      window: { title: `${toolName} - Ability Choice` },
      classes: ["toolful-choice-dialog"],
      content: `
        <p class="toolful-prompt">Choose an ability for <strong>${toolName}</strong>:</p>
        <p class="toolful-hint">${keyHints}</p>`,
      buttons,
      rejectClose: false,
      close: () => null
    });

    console.log(`${MODULE_ID} | Choice:`, result);

    if (!result || result === "cancel") return null;
    return result;
  } catch (err) {
    console.error(`${MODULE_ID} | Dialog error`, err);
    return null;
  }
}
