import routes from "../routes/routes";
import { getActiveRoute } from "../routes/url-parser";
import { subscribeNotification, unsubscribeNotification } from "../data/api";

const VAPID_PUBLIC_KEY = "BCCs2eonMI-6H2ctvFaWg-UYdDv387Vno_bzUzALpB442r2lCnsHmtrx8biyPi_E-1fSGABK_Qs_GlvPoJJqxbk";

class App {
  #content = null;
  #drawerButton = null;
  #navigationDrawer = null;
  #subscribeButton = null;
  #serviceWorkerRegistration = null;
  #isSubscribed = false;
  #currentPage = null;

  constructor({ navigationDrawer, drawerButton, content }) {
    this.#content = content;
    this.#drawerButton = drawerButton;
    this.#navigationDrawer = navigationDrawer;

    this._setupDrawer();
    this._addSubscribeButton();
    this._initPushSubscriptionStatus();
  }

  _setupDrawer() {
    this.#drawerButton.addEventListener("click", () => {
      this.#navigationDrawer.classList.toggle("open");
    });

    document.body.addEventListener("click", (event) => {
      if (
        !this.#navigationDrawer.contains(event.target) &&
        !this.#drawerButton.contains(event.target)
      ) {
        this.#navigationDrawer.classList.remove("open");
      }

      this.#navigationDrawer.querySelectorAll("a").forEach((link) => {
        if (link.contains(event.target)) {
          this.#navigationDrawer.classList.remove("open");
        }
      });
    });
  }

  _addSubscribeButton() {
    // Create the subscribe/unsubscribe button with bell icon
    this.#subscribeButton = document.createElement("button");
    this.#subscribeButton.id = "push-subscribe-btn";
    this.#subscribeButton.style.display = "flex";
    this.#subscribeButton.style.alignItems = "center";
    this.#subscribeButton.style.gap = "8px";
    this.#subscribeButton.style.background = "none";
    this.#subscribeButton.style.border = "none";
    this.#subscribeButton.style.color = "#2a9d8f";
    this.#subscribeButton.style.fontSize = "16px";
    this.#subscribeButton.style.cursor = "pointer";
    this.#subscribeButton.style.padding = "10px 15px";
    this.#subscribeButton.style.width = "100%";
    this.#subscribeButton.style.textAlign = "left";

    // Bell icon SVG
    this.#subscribeButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="M12 24c1.104 0 2-.896 2-2h-4c0 1.104.896 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V6c0-.828-.672-1.5-1.5-1.5S11.5 5.172 11.5 6v.68C8.64 7.36 7 9.93 7 13v5l-2 2v1h14v-1l-2-2z"/>
      </svg>
      <span>Subscribe</span>
    `;

    this.#subscribeButton.addEventListener("click", () => this._toggleSubscription());

    // Insert the button at the top of the navigation drawer
    this.#navigationDrawer.insertBefore(this.#subscribeButton, this.#navigationDrawer.firstChild);
  }

  async _initPushSubscriptionStatus() {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service workers are not supported in this browser.');
      this._updateSubscribeButton(false);
      return;
    }

    try {
      this.#serviceWorkerRegistration = await navigator.serviceWorker.getRegistration();
      if (!this.#serviceWorkerRegistration) {
        this._updateSubscribeButton(false);
        return;
      }

      const subscription = await this.#serviceWorkerRegistration.pushManager.getSubscription();
      this.#isSubscribed = subscription !== null;
      this._updateSubscribeButton(this.#isSubscribed);
    } catch (error) {
      console.error('Error checking push subscription status:', error);
      this._updateSubscribeButton(false);
    }
  }

  _updateSubscribeButton(isSubscribed) {
    if (!this.#subscribeButton) return;
    this.#isSubscribed = isSubscribed;
    const span = this.#subscribeButton.querySelector("span");
    const svg = this.#subscribeButton.querySelector("svg");

    if (isSubscribed) {
      span.textContent = "Unsubscribe";
      svg.style.fill = "#e63946"; // red color for unsubscribe
    } else {
      span.textContent = "Subscribe";
      svg.style.fill = "#2a9d8f"; // default color
    }
  }

  async _toggleSubscription() {
    if (!this.#serviceWorkerRegistration) {
      console.warn('Service worker registration not found.');
      return;
    }

    const token = localStorage.getItem('token');
    console.log('Token from localStorage:', token);
    if (!token) {
      alert('You must be logged in to manage push notifications.');
      return;
    }

    try {
      if (this.#isSubscribed) {
        // Unsubscribe
        const subscription = await this.#serviceWorkerRegistration.pushManager.getSubscription();
        if (subscription) {
          const unsubscribed = await subscription.unsubscribe();
          if (unsubscribed) {
            await unsubscribeNotification(token, subscription.endpoint);
            console.log('Unsubscribed from push notifications.');
          } else {
            console.warn('Failed to unsubscribe from push manager.');
          }
          // Refresh subscription status after unsubscribe
          const newSubscription = await this.#serviceWorkerRegistration.pushManager.getSubscription();
          this.#isSubscribed = newSubscription !== null;
          this._updateSubscribeButton(this.#isSubscribed);
        }
      } else {
        // Subscribe
        const permission = await Notification.requestPermission();
        console.log('Notification permission status:', permission);
        if (permission !== 'granted') {
          alert('Notification permission not granted.');
          return;
        }

        const subscription = await this.#serviceWorkerRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });

        const subscriptionData = {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')),
            auth: this.arrayBufferToBase64(subscription.getKey('auth')),
          },
        };

        await subscribeNotification(token, subscriptionData);
        this._updateSubscribeButton(true);
        console.log('Subscribed to push notifications.');
      }
    } catch (error) {
      console.error('Error toggling push subscription:', error);
    }
  }

  async registerServiceWorkerAndSubscribe() {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service workers are not supported in this browser.');
      return;
    }

    try {
      // Use relative path for service worker registration to support GitHub Pages subfolder deployment
      const basePath = window.location.pathname.replace(/\/[^\/]*$/, '/');
      const swPath = basePath + 'service-worker.js';
      this.#serviceWorkerRegistration = await navigator.serviceWorker.register(swPath);
      console.log('Service Worker registered with scope:', this.#serviceWorkerRegistration.scope);
    } catch (error) {
      console.error('Failed to register service worker:', error);
    }
  }

  async _subscribeToPush() {
    if (!this.#serviceWorkerRegistration) {
      console.warn('Service worker registration not found.');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      console.log('Notification permission status:', permission);
      if (permission !== 'granted') {
        console.warn('Notification permission not granted.');
        return;
      }

      const existingSubscription = await this.#serviceWorkerRegistration.pushManager.getSubscription();
      if (existingSubscription) {
        console.log('Already subscribed to push notifications.');
        this._updateSubscribeButton(true);
        return;
      }

      const subscription = await this.#serviceWorkerRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const token = localStorage.getItem('token');
      console.log('Token from localStorage:', token);
      if (!token) {
        console.warn('User token not found, cannot subscribe to push notifications.');
        return;
      }

      const subscriptionData = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')),
          auth: this.arrayBufferToBase64(subscription.getKey('auth')),
        },
      };

      await subscribeNotification(token, subscriptionData);
      this._updateSubscribeButton(true);
      console.log('Subscribed to push notifications.');
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
    }
  }

  async _toggleSubscription() {
    if (!this.#serviceWorkerRegistration) {
      console.warn('Service worker registration not found.');
      return;
    }

    const token = localStorage.getItem('token');
    console.log('Token from localStorage:', token);
    if (!token) {
      alert('You must be logged in to manage push notifications.');
      return;
    }

    try {
      if (this.#isSubscribed) {
        // Unsubscribe
        const subscription = await this.#serviceWorkerRegistration.pushManager.getSubscription();
        if (subscription) {
          const unsubscribed = await subscription.unsubscribe();
          if (unsubscribed) {
            await unsubscribeNotification(token, subscription.endpoint);
            console.log('Unsubscribed from push notifications.');
          } else {
            console.warn('Failed to unsubscribe from push manager.');
          }
          // Refresh subscription status after unsubscribe
          const newSubscription = await this.#serviceWorkerRegistration.pushManager.getSubscription();
          this.#isSubscribed = newSubscription !== null;
          this._updateSubscribeButton(this.#isSubscribed);
        }
      } else {
        // Subscribe
        await this._subscribeToPush();
      }
    } catch (error) {
      console.error('Error toggling push subscription:', error);
    }
  }

  handleAddToHomeScreen() {
    let deferredPrompt;
    const addBtn = document.createElement('button');
    addBtn.textContent = 'Add to Homescreen';
    addBtn.style.position = 'fixed';
    addBtn.style.bottom = '20px';
    addBtn.style.right = '20px';
    addBtn.style.padding = '10px 20px';
    addBtn.style.backgroundColor = '#4CAF50';
    addBtn.style.color = 'white';
    addBtn.style.border = 'none';
    addBtn.style.borderRadius = '5px';
    addBtn.style.cursor = 'pointer';
    addBtn.style.zIndex = '1000';
    addBtn.style.display = 'none';

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      addBtn.style.display = 'block';
    });

    addBtn.addEventListener('click', async () => {
      addBtn.style.display = 'none';
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          console.log('User accepted the A2HS prompt');
        } else {
          console.log('User dismissed the A2HS prompt');
        }
        deferredPrompt = null;
      }
    });

    document.body.appendChild(addBtn);
  }

  async renderPage() {
    const url = getActiveRoute();
    let page = routes[url];

    if (!page) {
      page = routes["*"];
    }

    if (this.#currentPage && typeof this.#currentPage.cleanup === "function") {
      this.#currentPage.cleanup();
    }

    if (document.startViewTransition) {
      document.startViewTransition(async () => {
        this.#content.innerHTML = await page.render();
        await page.afterRender();
        this.#currentPage = page;
        await this.registerServiceWorkerAndSubscribe();
        this.handleAddToHomeScreen();
      });
    } else if (this.#content.animate) {

      const fadeOut = this.#content.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 300,
        easing: "ease-in",
      });
      fadeOut.onfinish = async () => {
        this.#content.innerHTML = await page.render();
        await page.afterRender();
        this.#content.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 300,
          easing: "ease-out",
        });
        this.#currentPage = page;
        await this.registerServiceWorkerAndSubscribe();
        this.handleAddToHomeScreen();
      };
    } else {
      this.#content.innerHTML = await page.render();
      await page.afterRender();
      this.#currentPage = page;
      await this.registerServiceWorkerAndSubscribe();
      this.handleAddToHomeScreen();
    }
  }

  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }
}

export default App;
