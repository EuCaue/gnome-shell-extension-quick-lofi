<div align="center">

<img src="./icon.svg" width="192px" height="192px" />

# Quick Lofi

Play **lofi music and other sounds** on your GNOME desktop with just a **click**!

[![GitHub Release](https://img.shields.io/github/v/release/EuCaue/quick-lofi?include_prereleases&sort=date&display_name=release&style=for-the-badge&logo=github&)](https://github.com/EuCaue/quick-lofi/releases)
[![GitHub last commit](https://img.shields.io/github/last-commit/EuCaue/quick-lofi?style=for-the-badge&logo=github&color=blue)](https://github.com/EuCaue/quick-lofi/commits/master)
[![GitHub Repo stars](https://img.shields.io/github/stars/EuCaue/quick-lofi?style=for-the-badge&logo=github)](https://github.com/EuCaue/quick-lofi/stargazers)

[![Ko-fi](https://img.shields.io/badge/Ko--fi-Buy%20Me%20a%20Coffee-ff5f5f?logo=kofi&logoColor=white&style=for-the-badge)](https://ko-fi.com/eucaue)

[<img height="100" src="https://github.com/andyholmes/gnome-shell-extensions-badge/raw/master/get-it-on-ego.png">](https://extensions.gnome.org/extension/6904/quick-lofi/)

</div>

## Demo

[quick-lofi-demo.webm](https://github.com/EuCaue/gnome-shell-extension-quick-lofi/assets/69485603/351f34da-023c-4b28-94d6-b49ca83aa34d)

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
   npm run compile-schemas && npm run prod:install
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

3. Build and run in development mode:

   ```bash
   npm run dev
   ```

   This will watch for changes and reload the extension automatically.

---

<small>
  <div align="center">
    Made with ❤️  by  <a href="https://www.github.com/EuCaue" target="_blank">EuCaue</a>
  </div>
</small>
