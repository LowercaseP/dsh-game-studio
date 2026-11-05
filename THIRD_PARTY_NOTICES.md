# Third-Party Notices

This distribution includes the following third-party components.

## three.js 0.187.0

- Role: bundled into `lib/vendor/three.js` by `npm run build` and inlined into
  every exported 3D (voxel) game, which must run offline. Its license is also
  copied to `lib/vendor/three.LICENSE.txt`.
- Source: https://github.com/mrdoob/three.js
- Package: https://www.npmjs.com/package/three
- License: MIT

```text
The MIT License

Copyright © 2010-2026 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

## qrcode-generator 2.0.4

- Role: bundled into `lib/client.js`; draws the QR code in the sidebar's
  "play on your phone" panel.
- Source: https://github.com/kazuhikoarase/qrcode-generator
- Package: https://www.npmjs.com/package/qrcode-generator
- License: MIT
- The word "QR Code" is a registered trademark of DENSO WAVE INCORPORATED.

```text
MIT License

Copyright (c) 2009 Kazuhiko Arase

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Runtime dependencies (installed from npm, not bundled)

| Package | Version | Role | License |
| --- | --- | --- | --- |
| [playwright-core](https://github.com/microsoft/playwright) | 1.64.1 | drives the user's Chrome or Edge for playtests | Apache-2.0 |
| [pngjs](https://github.com/pngjs/pngjs) | 7.0.0 | reads and checks generated sprites | MIT |
| [undici](https://github.com/nodejs/undici) | 7.30.1 | HTTP client for the image service, including proxy support | MIT |

Their license texts ship inside their own npm packages.
