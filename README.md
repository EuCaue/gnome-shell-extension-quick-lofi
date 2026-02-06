<div align="center">

<img src="./logo.svg" width="192px" height="192px" />

# Quick Lofi

Play **lofi music and other sounds, locally or online**, on your GNOME desktop with just a **click**!

[![GitHub Release](https://img.shields.io/github/v/release/EuCaue/quick-lofi?include_prereleases&sort=date&display_name=release&style=for-the-badge&logo=github&)](https://github.com/EuCaue/quick-lofi/releases)
[![GitHub last commit](https://img.shields.io/github/last-commit/EuCaue/quick-lofi?style=for-the-badge&logo=github&color=blue)](https://github.com/EuCaue/quick-lofi/commits/master)
[![GitHub Repo stars](https://img.shields.io/github/stars/EuCaue/quick-lofi?style=for-the-badge&logo=github)](https://github.com/EuCaue/quick-lofi/stargazers)

![GNOME Supported Version](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fgithub.com%2FEuCaue%2Fgnome-shell-extension-quick-lofi%2Fraw%2Fmaster%2Fsrc%2Fmetadata.json&query=%24%5B'shell-version'%5D&style=for-the-badge&logo=gnome&label=Compatible%20with%20GNOME)

[![Ko-fi](https://img.shields.io/badge/Ko--fi-Buy%20Me%20a%20Coffee-ff5f5f?logo=kofi&logoColor=white&style=for-the-badge)](https://ko-fi.com/eucaue)

[<img height="100" src="https://github.com/andyholmes/gnome-shell-extensions-badge/raw/master/get-it-on-ego.png">](https://extensions.gnome.org/extension/6904/quick-lofi/)

</div>

## Demo

[quick-lofi-demo.webm](https://github.com/EuCaue/gnome-shell-extension-quick-lofi/assets/69485603/351f34da-023c-4b28-94d6-b49ca83aa34d)

## Features

- Play lofi and any other sound with one click
- Global keyboard shortcuts for quick control
- Volume control directly from pop-up menu
- Drag and drop to rearrange radio stations
- Adjustable pop-up height

## Dependencies

This extension requires `mpv`. Install it using your package manager:

```bash
# Fedora
sudo dnf install mpv
```

```bash
# Debian/Ubuntu
sudo apt install mpv
```

```bash
# Arch
sudo pacman -S mpv
```

```bash
# openSUSE
sudo zypper install mpv
```

## Installation

### Via [EGO](https://extensions.gnome.org/extension/6904/quick-lofi/)

1. Install from the [extension page](https://extensions.gnome.org/extension/6904/quick-lofi/) using the [browser integration](https://gnome.pages.gitlab.gnome.org/gnome-browser-integration/pages/installation-guide.html#fedora_linux) or the [Extension Manager](https://flathub.org/apps/com.mattjakeman.ExtensionManager).

### From the release `.zip`

1. Download `quicklofi@eucaue.zip` from the [releases page](https://github.com/EuCaue/gnome-shell-extension-quick-lofi/releases).
2. Run in the same folder:

   ```bash
   gnome-extensions install --force quicklofi@eucaue.zip
   ```

3. Log out and back in.

### Manual installation

> You’re installing the latest release, which may not work on older GNOME versions, check the release notes.
> Requires `Node` and `NPM`.

1. Clone the repository:

   ```bash
   git clone https://github.com/EuCaue/gnome-shell-extension-quick-lofi.git
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Build and install:

   ```bash
   npm run install:prod
   ```

4. Log out and back in.

---

## Development

> Requires `Node` and `NPM`.

Set up a local environment to work on the extension:

1. Clone the repository:

   ```bash
   git clone https://github.com/EuCaue/gnome-shell-extension-quick-lofi.git
   cd gnome-shell-extension-quick-lofi
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Build and run the extension in a nested GNOME Wayland session:

   ```bash
   npm run run:dev
   ```

---

## Troubleshooting

If something isn’t working as expected, enabling debug logs helps a lot when diagnosing problems.
Please follow the steps below **before opening an issue**.

### Enable debug logging

Debug logging can be enabled either from the **extension preferences** or via the CLI.

**From the UI:**

- Open **Quick Lofi Preferences**
- Go to the **Interface** tab
- Enable **Debug logging**

**From the CLI:**

```bash
gsettings --schemadir "$HOME/.local/share/gnome-shell/extensions/quick-lofi@eucaue/schemas" set "org.gnome.shell.extensions.quick-lofi" "enable-debug" true
```

### Collect logs

When debug logging is enabled, Quick Lofi writes logs to:

```text
/tmp/quick-lofi-$USER.log
```

To view the logs:

```bash
cat /tmp/quick-lofi-$USER.log
```

To copy the logs to your clipboard:

```bash
cat /tmp/quick-lofi-$USER.log | wl-copy
```

If the file is empty or missing, make sure debug logging is enabled and reproduce the issue once more.

### Open an issue

When opening a new issue, please include:

- A **clear description** of the problem
- **Steps to reproduce**
- Your **GNOME version**
- Your **Quick Lofi version**
- The **debug logs** collected above (paste them or attach the file)

<div align="center">

[Open an issue here](https://github.com/EuCaue/gnome-shell-extension-quick-lofi/issues)

</div>

---

## Contributing

Contributions are always welcome! 💡

1. **Fork** the repository and create a new branch for your changes.
2. **Make your improvements** whether it’s fixing a bug, improving code, or adding a feature.
3. **Commit and push** your changes to your branch.
4. **Open a pull request** with a short description of what you’ve done.
5. If you find any bugs or have ideas, feel free to **open an issue** anytime!

---

<small>
  <div align="center">
    Made with ❤️  by  <a href="https://www.github.com/EuCaue" target="_blank">EuCaue</a>
  </div>
</small>
