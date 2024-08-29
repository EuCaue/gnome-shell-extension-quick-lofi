# Quick Lofi

<!--toc:start-->

- [Quick Lofi](#quick-lofi)
  - [Demo](#demo)
  - [Dependencies](#dependencies)
  - [Development](#development)
  <!--toc:end-->

> Play **lofi music** on your Gnome desktop with just a click!


[<img height="100" src="https://github.com/andyholmes/gnome-shell-extensions-badge/raw/master/get-it-on-ego.png">](https://extensions.gnome.org/extension/6904/quick-lofi/)

## Demo

[quick-lofi-demo.webm](https://github.com/EuCaue/gnome-shell-extension-quick-lofi/assets/69485603/351f34da-023c-4b28-94d6-b49ca83aa34d)

## Dependencies

The app depends on `mpv` to play the music,
which you can install it with the following command:

```bash
# Fedora
sudo dnf install mpv

# Debian/Ubuntu based
sudo apt install mpv

# Arch based
sudo pacman -S mpv
```

Additionally, for now, it depends on the `socat` package.
You can install it using the following command:

```bash
# Fedora
sudo dnf install socat

# Debian/Ubuntu based
sudo apt install socat

# Arch based
sudo pacman -S socat
```

## Installing manually the extension

1.  Clone the repo

    ```bash
    git clone https://github.com/EuCaue/gnome-shell-extension-quick-lofi.git
    ```

2.  Installing the packages

    ```bash
    npm install
    ```

3.  Installing the extension

    ```bash
    npm run compile-schemas && npm run prod
    ```

---

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
