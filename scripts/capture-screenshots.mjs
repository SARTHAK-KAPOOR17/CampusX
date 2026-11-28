// scripts/capture-screenshots.mjs
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = path.resolve('docs/screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const { resolve, reject } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) reject(msg.error);
          else resolve(msg.result);
        }
      } catch (err) {
        console.error('WebSocket parse error:', err);
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = this.id++;
      this.callbacks.set(msgId, { resolve, reject });
      this.ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

async function capture() {
  console.log('Launching headless Chrome with remote debugging on port 9222...');
  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,880',
    'http://localhost:5173/marketplace',
  ]);

  let targetWsUrl = null;
  for (let i = 0; i < 30; i++) {
    await sleep(500);
    try {
      const res = await fetch('http://127.0.0.1:9222/json');
      const list = await res.json();
      if (list && list.length > 0 && list[0].webSocketDebuggerUrl) {
        targetWsUrl = list[0].webSocketDebuggerUrl;
        break;
      }
    } catch {
      // Chrome still starting up
    }
  }

  if (!targetWsUrl) {
    chromeProcess.kill();
    throw new Error('Failed to connect to Chrome DevTools port 9222');
  }

  console.log('Connected to Chrome DevTools via WebSocket:', targetWsUrl);
  const cdp = new CDPClient(targetWsUrl);
  await cdp.connect();

  await cdp.send('Page.enable');
  await cdp.send('DOM.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 880,
    deviceScaleFactor: 2,
    mobile: false,
  });

  async function takeScreenshot(fileName, delayMs = 1200) {
    await sleep(delayMs);
    const result = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(result.data, 'base64');
    const dest = path.join(SCREENSHOT_DIR, fileName);
    fs.writeFileSync(dest, buffer);
    console.log(`Saved screenshot: ${fileName} (${(buffer.length / 1024).toFixed(1)} KB)`);
  }

  async function evaluate(expression) {
    const res = await cdp.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return res?.result?.value;
  }

  try {
    // Wait for initial app load
    await sleep(2000);
    const navType = await evaluate("typeof window.__navigate");
    console.log('window.__navigate type:', navType);

    // 1. Marketplace Grid
    console.log('\n--- Capturing 01-marketplace-grid.png ---');
    await evaluate(`window.__navigate('/marketplace');`);
    await takeScreenshot('01-marketplace-grid.png', 1800);

    // 2. Wishlist Heart Pop Interaction
    console.log('\n--- Capturing 02-wishlist-heart-pop.png ---');
    await evaluate(`
      const heartBtn = document.querySelector('button[aria-label="Save to wishlist"]');
      if (heartBtn) heartBtn.click();
    `);
    await takeScreenshot('02-wishlist-heart-pop.png', 800);

    // 3. Notification Bell Dropdown with Unread Badge & Staggered List
    console.log('\n--- Capturing 03-notification-bell-dropdown.png ---');
    await evaluate(`
      const notifBtn = document.querySelector('button[aria-label="View notifications"]');
      if (notifBtn) notifBtn.click();
    `);
    await takeScreenshot('03-notification-bell-dropdown.png', 1200);

    // Close notification dropdown
    await evaluate(`
      const notifBtn = document.querySelector('button[aria-label="View notifications"]');
      if (notifBtn) notifBtn.click();
    `);

    // 4. Product Detail Page
    console.log('\n--- Capturing 04-product-detail.png ---');
    await evaluate(`
      const firstLink = document.querySelector('a[href^="/products/"]');
      if (firstLink) firstLink.click();
    `);
    await takeScreenshot('04-product-detail.png', 1800);

    // 5. Google Sign-In & Login Page
    console.log('\n--- Capturing 05-login-google-signin.png ---');
    await evaluate(`window.__navigate('/login');`);
    await takeScreenshot('05-login-google-signin.png', 1500);

    // 6. Direct In-App Authentication & Dashboard with Animated Stats
    console.log('\n--- Logging in and Capturing 06-dashboard-animated-stats.png ---');
    await evaluate(`
      (async () => {
        try {
          if (window.__authStore) {
            window.__authStore.getState().setAuth({
              user: {
                id: 'usr-chitkara-student-1',
                name: 'Arjun Sharma',
                email: 'arjun.sharma@chitkara.edu.in',
                collegeEmail: 'arjun.sharma@chitkara.edu.in',
                role: 'STUDENT',
                isVerifiedStudent: true,
                authProvider: 'GOOGLE',
                profilePictureUrl: null,
                course: 'B.Tech',
                branch: 'Computer Science & Engineering',
                year: 3,
                bio: 'CSE undergrad passionate about AI and systems. Selling semester textbooks and campus cycling gear.',
              },
              accessToken: 'mock-session-active-token',
            });
          }
          if (window.__wishlistStore) {
            window.__wishlistStore.getState().toggle({
              id: 'item-calculus-8th',
              title: 'Stewart Calculus: Early Transcendentals (8th Edition)',
              price: 450,
              isNegotiable: true,
              condition: 'LIKE_NEW',
              category: { name: 'Books' },
              seller: { name: 'Aarav Sharma', isVerifiedStudent: true },
            });
            window.__wishlistStore.getState().toggle({
              id: 'item-cycle-hero',
              title: 'Hero Sprint Pro 21-Speed Mountain Bike',
              price: 2800,
              isNegotiable: false,
              condition: 'GOOD',
              category: { name: 'Cycles' },
              seller: { name: 'Priya Mehra', isVerifiedStudent: true },
            });
            window.__wishlistStore.getState().toggle({
              id: 'item-ti84-calc',
              title: 'Texas Instruments TI-84 Plus Graphing Calculator',
              price: 1850,
              isNegotiable: true,
              condition: 'NEW',
              category: { name: 'Electronics' },
              seller: { name: 'Rohan Gupta', isVerifiedStudent: true },
            });
          }
          window.__navigate('/dashboard');
        } catch (e) {
          console.error(e);
        }
      })()
    `);
    await takeScreenshot('06-dashboard-animated-stats.png', 1800);

    // 7. Dashboard Saved Wishlist Tab with Staggered Fade-in
    console.log('\n--- Capturing 07-dashboard-saved-wishlist.png ---');
    await evaluate(`
      const buttons = Array.from(document.querySelectorAll('button'));
      const wishlistBtn = buttons.find(b => b.textContent.includes('Saved Wishlist'));
      if (wishlistBtn) wishlistBtn.click();
    `);
    await takeScreenshot('07-dashboard-saved-wishlist.png', 1500);

    // 8. User Profile Page with Verified Student & Badges
    console.log('\n--- Capturing 08-user-profile.png ---');
    await evaluate(`window.__navigate('/profile');`);
    await takeScreenshot('08-user-profile.png', 1500);

    console.log('\nAll feature screenshots captured successfully!');
  } finally {
    cdp.close();
    chromeProcess.kill();
  }
}

capture().catch((err) => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
