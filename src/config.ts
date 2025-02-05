import { app } from 'electron';
const path = require('path');
const fs = require("fs");

export type AppConfig = {
  emuPath: string;
  filePathBase: string;
  isDev: boolean;
}

export type EmulatorConfig = {
  fightcadePath: string;
  luaPath: string;
}

export type Config = {
  app: AppConfig;
  emulator: EmulatorConfig;
}

function getConfigFileMap(filePathBase: string): Record<string, string> {
  const filePath = path.join(filePathBase, 'config.txt');
  const s: string = fs.readFileSync(filePath, { encoding: 'utf8' });

  // We split all lines then, all become key-values
  // pairs
  return s.split('\n')
    .reduce((kv, line) => {
      const [k, v] = line.split('=')
      return { ...kv, [k]: v }
    }, {});
}

function getAppConfig(): AppConfig {
  const isDev = !app.isPackaged;

  //handle dev mode toggle for file paths.
  const filePathBase = isDev 
    ? path.join(app.getAppPath(), "src")
    : process.resourcesPath

  const configFileMap = getConfigFileMap(filePathBase);

  return {
    emuPath: configFileMap.emuPath,
    filePathBase,
    isDev,
  }
}

function getEmulatorConfig({ emuPath, filePathBase }: AppConfig) {
  return {
    fightcadePath: path.join(emuPath, "fcadefbneo.exe"),
    luaPath: path.join(filePathBase, 'lua', '3rd_training_lua', '3rd_training.lua'),
  }
}

export function getConfig() {
  let app: AppConfig;
  try {
    app = getAppConfig();
  } catch(e) {
    console.error(`could not get app config: ${e}`)
    throw e;
  }

  let emulator: EmulatorConfig;
  try {
    emulator = getEmulatorConfig(app);
  } catch(e) {
    console.error(`could not get emulator config: ${e}`)
    throw e;
  }

  return {
    app,
    emulator,
  }
}
