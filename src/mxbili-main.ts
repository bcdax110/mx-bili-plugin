import axios from "axios";
import getPort from "get-port";
import { debounce, Notice, Plugin, Setting } from "obsidian";

import fetchBiliPoster from "./fake-bili/fetch-poster";
import getServer from "./fake-bili/proxy/server";

export default class MxBili extends Plugin {
  settings: MxBiliSettings = DEFAULT_SETTINGS;

  server?: ReturnType<typeof getServer>;

  fetchPoster = fetchBiliPoster;

  setupProxy = (port: number, sessdata?: string): void => {
    if (this.server) this.server.close().listen(port);
    else {
      if (sessdata) {
        this.server = getServer(port, `SESSDATA=${sessdata}`);
      } else {
        this.server = getServer(port);
      }
      this.server.on("error", (err) => {
        if (err.message.includes("EADDRINUSE"))
          new Notice("端口已被占用，请在Media Extended设置中更改端口号");
        else console.error(err);
      });
    }
  };

  /**
   * detect if port being used, and save free port
   * @param port desire port
   * @returns free port
   */
  setupPort = async (port: number): Promise<number> => {
    const newPort = await getPort({ port });
    if (newPort !== port) {
      new Notice(`${port}端口已被占用，切换至${newPort}`);
    }
    if (this.settings.port !== newPort) {
      this.settings.port = newPort;
      await this.saveSettings();
    }
    return newPort;
  };

  setupSessdata = async (sessdata?: string): Promise<string | undefined> => {
    if (this.settings.sessdata !== sessdata) {
      this.settings.sessdata = sessdata;
      await this.saveSettings();
    }
    return sessdata;
  };

  async onload() {
    console.log("loading MxBili");

    await this.loadSettings();

    axios.defaults.adapter = "http";

    const newPort = await this.setupPort(this.settings.port);
    const sessdata = await this.setupSessdata(this.settings.sessdata);
    this.setupProxy(newPort, sessdata);
  }

  onunload() {
    console.log("unloading MxBili");

    this.server?.close();
  }

  async loadSettings() {
    this.settings = { ...this.settings, ...(await this.loadData()) };
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  portSetting = (containerEl: HTMLElement) =>
    new Setting(containerEl)
      .setName("代理端口号")
      .setDesc("若与现有端口冲突请手动指定其他端口")
      .addText((text) => {
        const save = debounce(
          async (value: string) => {
            const newPort = await this.setupPort(+value);
            if (newPort !== +value) text.setValue(newPort.toString());
            this.setupProxy(newPort, this.settings.sessdata);
          },
          500,
          true,
        );
        text
          .setValue(this.settings.port.toString())
          .onChange(async (value: string) => {
            text.inputEl.toggleClass("incorrect", !isVaildPort(value));
            if (isVaildPort(value) && this.settings.port !== +value)
              save(value);
          });
      });

  sessdataSetting = (containerEl: HTMLElement) =>
    new Setting(containerEl)
      .setName("登录凭证")
      .setDesc(
        createFragment((desc) => {
          desc.appendText("获取视频高清版本需要登录 bilibili 账号");
          desc.createEl("br");
          desc.createEl("br");
          desc.appendText("在此处填写 Cookie 的 SESSDATA 值");
          desc.createEl("br");
          desc.createEl("br");
          desc.appendText("SESSDATA 值获取方法：");
          desc.createEl("br");
          desc.appendText("1. 打开");
          desc.createEl("a", {
            href: "https://www.bilibili.com/",
            text: "网页版 bilibili",
          });
          desc.createEl("br");
          desc.appendText("2. 在浏览器中按下 F12 键打开浏览器的开发者工具");
          desc.createEl("br");
          desc.appendText(
            "3. 在 Application/Storage/Cookies 中找到含有 bilibili.com 的选项并选中",
          );
          desc.createEl("br");
          desc.appendText(
            "4. 在右侧找到 Name 为 SESSDATA 的选项，将对应的 Vale 粘贴到此处",
          );
        }),
      )
      .addText((text) => {
        const save = debounce(async (value: string) => {
          const sessdata = await this.setupSessdata(value);
          if (sessdata) {
            text.setValue(sessdata);
          }
          this.setupProxy(this.settings.port, sessdata);
        });
        if (this.settings.sessdata) {
          text.setValue(this.settings.sessdata.toString());
        }
        text.onChange(async (value: string) => {
          save(value);
        });
      });
}

interface MxBiliSettings {
  port: number;
  sessdata?: string;
}

const DEFAULT_SETTINGS: MxBiliSettings = {
  port: 2233,
  sessdata: undefined,
};

const isVaildPort = (str: string) => {
  const test =
    /^()([1-9]|[1-5]?[0-9]{2,4}|6[1-4][0-9]{3}|65[1-4][0-9]{2}|655[1-2][0-9]|6553[1-5])$/;
  return test.test(str);
};
