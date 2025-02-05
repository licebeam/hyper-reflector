import { app } from 'electron';
const path = require('path');
const fs = require("fs");
// import path from "path";
// import fs from "fs";

export type AppConfig = {
  filePathBase: string;
  isDev: boolean;
}

export type EmulatorConfig = {
  emuPath: string;
  fightcadePath: string;
  luaPath: string;
}

export type Config = {
  app: AppConfig;
  emulator: EmulatorConfig;
}

const DEFAULT_CONFIG: EmulatorConfig = {
  emuPath: "",
  fightcadePath: "",
  luaPath: "",
}

function getConfigFilePath(filePathBase: string) {
  return path.join(filePathBase, "..", "resources/config.json")
}

function isEmulatorConfig(config: unknown): config is EmulatorConfig {
  return typeof config === 'object' && 
    'emuPath' in config && 
    'fightcadePath' in config && 
    'luaPath' in config;
}

function getEmulatorConfig({filePathBase}: AppConfig): EmulatorConfig {
  const filePath = getConfigFilePath(filePathBase);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(DEFAULT_CONFIG, null, 2), {})
  }
  const config = JSON.parse(fs.readFileSync(filePath, { encoding: 'utf8' }));
  if (!isEmulatorConfig(config)) {
    console.warn('emulator config file was corrupted, writing a new one');
    fs.writeFileSync(filePath, JSON.stringify(DEFAULT_CONFIG, null, 2), {})
  }

  return config;
}

export async function setEmulatorConfig({filePathBase}: AppConfig, emuPath: string) {
  // this will throw if the path is invalid
  path.parse(emuPath)

  // TODO: maybe set config individually?
  // here we just write all the defaults from emupath
  const emulatorConfig = {
    emuPath,
    fightcadePath: path.join(emuPath, "fcadefbneo.exe"),
    luaPath: path.join(filePathBase, 'lua', '3rd_training_lua', '3rd_training.lua'),
  }

  fs.writeFileSync(
    getConfigFilePath(filePathBase), 
    JSON.stringify(emulatorConfig, null, 2),
  );
}

// TODO: maybe this should just be some context we carry
// around the app
function getAppConfig(): AppConfig {
  const isDev = !app.isPackaged;

  //handle dev mode toggle for file paths.
  const filePathBase = isDev 
    ? path.join(app.getAppPath(), "src")
    : process.resourcesPath

  return {
    filePathBase,
    isDev,
  }
}

export function getConfig() {
  const app = getAppConfig();
  const emulator = getEmulatorConfig(app);

  return {
    app,
    emulator,
  }
}
