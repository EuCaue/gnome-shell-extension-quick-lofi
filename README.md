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

The extension depends on `mpv` to work, which you can install it with the following command:

```bash
# Fedora
sudo dnf install mpv

# Debian/Ubuntu based
sudo apt install mpv

# Arch based
sudo pacman -S mpv
```

## Installation

### Installing via [EGO](https://extensions.gnome.org/extension/6904/quick-lofi/)

1. Install it from the [extension page](https://extensions.gnome.org/extension/6904/quick-lofi/) using the browser integration or with the [Extension Manager](https://flathub.org/apps/com.mattjakeman.ExtensionManager).

### Installing from the release `.zip`

1. Go to the [releases page](https://github.com/EuCaue/gnome-shell-extension-quick-lofi/releases) and download the `.zip` file (`quicklofi@eucaue.zip`).
2. In the folder where you downloaded the `.zip`, run:
   ```bash
   gnome-extensions install --force quicklofi@eucaue.zip
   ```
3. Log out and log back in.

### Installing the extension manually

> `Node` and `NPM` are required for this.

1. Clone the repo:

   ```bash
   git clone https://github.com/EuCaue/gnome-shell-extension-quick-lofi.git
   ```

2. Install the dependencies:

   ```bash
   npm install
   ```

3. Build and install the extension:

   ```bash
   npm run compile-schemas && npm run prod
   ```

## Development

1. Clone the repo

   ```bash
   git clone https://github.com/EuCaue/gnome-shell-extension-quick-lofi.git
   ```

2. Install Dependencies

   ```bash
   npm install
   ```

3. Build and run the extension

   ```bash
   npm run dev
   ```

---

<small>
  <center>
    Made with ❤️  by  <a href="https://www.github.com/EuCaue" target="_blank">EuCaue</a>
  </center>
</small>
