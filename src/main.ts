import { Plugin, type PluginManifest } from "obsidian";
import type { App } from "obsidian";
import https from "https";
import http from "http";
import type { PluginSettings, HandlerContext } from "./types";
import { DEFAULT_SETTINGS } from "./constants";
import { createApp } from "./server";
import { generateApiKey, generateCertificate, isCertificateValid } from "./crypto";
import { MetadataService } from "./services/metadata";
import { ResponseService } from "./services/responses";
import { FileResolverService } from "./services/file-resolver";
import { ObsidianApiSettingTab } from "./settings";

export default class ObsidianApiPlugin extends Plugin {
  settings!: PluginSettings;
  private secureServer: https.Server | null = null;
  private insecureServer: http.Server | null = null;
  private ctx!: HandlerContext;

  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
  }

  async onload(): Promise<void> {
    await this.loadSettings();

    // Ensure API key exists
    if (!this.settings.apiKey) {
      this.settings.apiKey = generateApiKey();
      await this.saveSettings();
    }

    // Ensure certificate exists and is valid
    if (!this.settings.crypto || !isCertificateValid(this.settings.crypto.cert)) {
      this.settings.crypto = generateCertificate(
        this.settings.bindingHost,
        this.settings.subjectAltNames,
      );
      await this.saveSettings();
    }

    // Build handler context
    this.ctx = {
      app: this.app,
      settings: this.settings,
      manifest: { ...this.manifest },
      metadata: new MetadataService(this.app),
      resolver: new FileResolverService(this.app),
      respond: new ResponseService(),
    };

    // Create Express app
    const expressApp = createApp(this.ctx);

    // Start servers
    this.startServers(expressApp);

    // Register settings tab
    this.addSettingTab(new ObsidianApiSettingTab(this.app, this));

    console.debug("[obsidian-api] Plugin loaded.");
  }

  onunload(): void {
    this.stopServers();
    console.debug("[obsidian-api] Plugin unloaded.");
  }

  async loadSettings(): Promise<void> {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private startServers(expressApp: ReturnType<typeof createApp>): void {
    const host = this.settings.bindingHost;

    if (this.settings.enableSecureServer && this.settings.crypto) {
      this.secureServer = https.createServer(
        {
          key: this.settings.crypto.privateKey,
          cert: this.settings.crypto.cert,
        },
        expressApp,
      );

      this.secureServer.listen(this.settings.port, host, () => {
        console.debug(
          `[obsidian-api] HTTPS server listening on https://${host}:${this.settings.port}`,
        );
      });

      this.secureServer.on("error", (err) => {
        console.error("[obsidian-api] HTTPS server error:", err.message);
      });
    }

    if (this.settings.enableInsecureServer) {
      this.insecureServer = http.createServer(expressApp);

      this.insecureServer.listen(this.settings.insecurePort, host, () => {
        console.debug(
          `[obsidian-api] HTTP server listening on http://${host}:${this.settings.insecurePort}`,
        );
      });

      this.insecureServer.on("error", (err) => {
        console.error("[obsidian-api] HTTP server error:", err.message);
      });
    }
  }

  private stopServers(): void {
    if (this.secureServer) {
      this.secureServer.close();
      this.secureServer = null;
    }
    if (this.insecureServer) {
      this.insecureServer.close();
      this.insecureServer = null;
    }
  }
}
