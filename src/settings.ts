import { PluginSettingTab, Setting } from "obsidian";
import type { App } from "obsidian";
import type ObsidianApiPlugin from "./main";
import { generateApiKey, generateCertificate } from "./crypto";
import { DEFAULT_SETTINGS } from "./constants";

export class ObsidianApiSettingTab extends PluginSettingTab {
  plugin: ObsidianApiPlugin;

  constructor(app: App, plugin: ObsidianApiPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Obsidian API Settings" });

    // Server URLs
    if (this.plugin.settings.enableSecureServer) {
      containerEl.createEl("p", {
        text: `HTTPS: https://${this.plugin.settings.bindingHost}:${this.plugin.settings.port}`,
        cls: "setting-item-description",
      });
    }
    if (this.plugin.settings.enableInsecureServer) {
      containerEl.createEl("p", {
        text: `HTTP: http://${this.plugin.settings.bindingHost}:${this.plugin.settings.insecurePort}`,
        cls: "setting-item-description",
      });
    }

    // API Key
    new Setting(containerEl)
      .setName("API Key")
      .setDesc("Bearer token for authentication")
      .addText((text) =>
        text
          .setPlaceholder("API Key")
          .setValue(this.plugin.settings.apiKey)
          .setDisabled(true),
      )
      .addButton((button) =>
        button.setButtonText("Copy").onClick(async () => {
          await navigator.clipboard.writeText(this.plugin.settings.apiKey);
        }),
      )
      .addButton((button) =>
        button.setButtonText("Regenerate").onClick(async () => {
          this.plugin.settings.apiKey = generateApiKey();
          await this.plugin.saveSettings();
          this.display();
        }),
      );

    // HTTPS Port
    new Setting(containerEl)
      .setName("HTTPS Port")
      .setDesc("Port for the secure HTTPS server")
      .addText((text) =>
        text
          .setPlaceholder("27124")
          .setValue(String(this.plugin.settings.port))
          .onChange(async (value) => {
            const port = parseInt(value, 10);
            if (!isNaN(port) && port > 0 && port < 65536) {
              this.plugin.settings.port = port;
              await this.plugin.saveSettings();
            }
          }),
      );

    // Enable insecure server
    new Setting(containerEl)
      .setName("Enable HTTP Server")
      .setDesc("Enable insecure HTTP server (not recommended)")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableInsecureServer)
          .onChange(async (value) => {
            this.plugin.settings.enableInsecureServer = value;
            await this.plugin.saveSettings();
          }),
      );

    // HTTP Port
    new Setting(containerEl)
      .setName("HTTP Port")
      .setDesc("Port for the insecure HTTP server")
      .addText((text) =>
        text
          .setPlaceholder("27123")
          .setValue(String(this.plugin.settings.insecurePort))
          .onChange(async (value) => {
            const port = parseInt(value, 10);
            if (!isNaN(port) && port > 0 && port < 65536) {
              this.plugin.settings.insecurePort = port;
              await this.plugin.saveSettings();
            }
          }),
      );

    // Binding host
    new Setting(containerEl)
      .setName("Binding Host")
      .setDesc("Host to bind the server to (127.0.0.1 for local only)")
      .addText((text) =>
        text
          .setPlaceholder("127.0.0.1")
          .setValue(this.plugin.settings.bindingHost)
          .onChange(async (value) => {
            this.plugin.settings.bindingHost = value || DEFAULT_SETTINGS.bindingHost;
            await this.plugin.saveSettings();
          }),
      );

    // CORS origin
    new Setting(containerEl)
      .setName("CORS Origin")
      .setDesc('Allowed CORS origin ("*" for all)')
      .addText((text) =>
        text
          .setPlaceholder("*")
          .setValue(this.plugin.settings.corsOrigin)
          .onChange(async (value) => {
            this.plugin.settings.corsOrigin = value || "*";
            await this.plugin.saveSettings();
          }),
      );

    // Certificate management
    containerEl.createEl("h3", { text: "Certificate" });

    new Setting(containerEl)
      .setName("Regenerate Certificate")
      .setDesc("Generate a new self-signed certificate")
      .addButton((button) =>
        button.setButtonText("Regenerate").onClick(async () => {
          this.plugin.settings.crypto = generateCertificate(
            this.plugin.settings.bindingHost,
            this.plugin.settings.subjectAltNames,
          );
          await this.plugin.saveSettings();
          this.display();
        }),
      );

    // Subject Alt Names
    new Setting(containerEl)
      .setName("Subject Alternative Names")
      .setDesc("Additional hostnames/IPs for the certificate (one per line)")
      .addTextArea((text) =>
        text
          .setPlaceholder("192.168.1.100\nmyhost.local")
          .setValue(this.plugin.settings.subjectAltNames)
          .onChange(async (value) => {
            this.plugin.settings.subjectAltNames = value;
            await this.plugin.saveSettings();
          }),
      );
  }
}
