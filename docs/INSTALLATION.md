# VisionEye Multi-Platform Installation Guide

VisionEye is available as a standalone desktop application for **macOS (Apple Silicon & Intel)**, **Windows (64-bit)**, **Linux**, and as a universal web application accessible from any mobile or desktop browser.

---

## 1. macOS Installation (Apple Silicon M1/M2/M3/M4 & Intel)

### Option A: Apple Silicon DMG (Recommended for M-Series)
1. Download **`VisionEye-macOS-AppleSilicon.dmg`** from [pvsairamsaketh.in](https://pvsairamsaketh.in).
2. Double-click the downloaded `.dmg` file.
3. Drag the **VisionEye** icon into your **Applications** folder.
4. Launch VisionEye from Spotlight (`Cmd + Space`) or Launchpad.

### Option B: Intel Mac DMG
1. Download **`VisionEye-macOS-Intel.dmg`** from [pvsairamsaketh.in](https://pvsairamsaketh.in).
2. Drag **VisionEye** to **Applications** and launch.

*Note on macOS Gatekeeper*: If prompted with an unverified developer warning, right-click the VisionEye icon in Applications, select **Open**, and click **Open** in the dialog.

---

## 2. Windows Installation (Windows 10 / 11 64-bit)

1. Download **`VisionEye-Windows-x64.exe`** from [pvsairamsaketh.in](https://pvsairamsaketh.in).
2. Double-click the installer.
3. Choose installation options (Desktop shortcut, Start menu entry).
4. Click **Install**.
5. Launch **VisionEye** from your Desktop or Start Menu.

---

## 3. Linux Installation (Ubuntu, Debian, Fedora, Arch)

### AppImage (Portable Executable)
1. Download **`VisionEye-Linux-x64.AppImage`** from [pvsairamsaketh.in](https://pvsairamsaketh.in).
2. Make it executable:
   ```bash
   chmod +x VisionEye-Linux-x64.AppImage
   ```
3. Run the application:
   ```bash
   ./VisionEye-Linux-x64.AppImage
   ```

### Debian / Ubuntu Package (.deb)
```bash
sudo dpkg -i VisionEye-Linux-x64.deb
sudo apt-get install -f
```

---

## 4. Universal Web & Mobile Access (Android, iOS, iPadOS, Any Browser)

Access the live cloud instance directly from any phone, tablet, or PC without installing any software:

- **Web Portal URL**: `https://pvsairamsaketh.in`
- Real-time video feeds, interactive 2D top-view minimaps, and telemetry charts work seamlessly on modern mobile Safari, Chrome, Firefox, and Edge browsers.
