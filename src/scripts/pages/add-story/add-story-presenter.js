import "leaflet/dist/leaflet.css";

import markerIcon from "/src/public/images/marker-icon.png";
import markerShadow from "/src/public/images/marker-shadow.png";

import { addStory as addStoryToIDB, getAllStories as getAllPendingStoriesFromIDB, deleteStory as deleteStoryFromIDB } from "../../utils/indexeddb.js";

export default class AddStoryPresenter {
  constructor(view) {
    this.view = view;
    this.L = null;
    this.map = null;
    this.marker = null;
    this.stream = null;
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
  }

  async init() {
    await this.loadLeaflet();
    this.initMap();
    this.initCameraControls();
    this.initFormSubmit();
    this.setupSyncPendingStories();
  }

  async loadLeaflet() {
    this.L = await import("leaflet");

    delete this.L.Icon.Default.prototype._getIconUrl;
    this.L.Icon.Default.mergeOptions({
      iconUrl: markerIcon,
      shadowUrl: markerShadow,
    });
  }

  initMap() {
    const L = this.L;
    this.map = L.map("map").setView([0, 0], 2);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(this.map);

    const latInput = document.getElementById("lat");
    const lonInput = document.getElementById("lon");

    this.map.on("click", (e) => {
      const { lat, lng } = e.latlng;
      latInput.value = lat;
      lonInput.value = lng;

      const customIcon = L.icon({
        iconUrl: markerIcon,
        shadowUrl: markerShadow,
        iconSize: [25, 41], 
        iconAnchor: [12, 41], 
        popupAnchor: [1, -34], 
        shadowSize: [41, 41], 
      });

      if (this.marker) {
        this.marker.setLatLng(e.latlng);
        this.marker.setIcon(customIcon);
      } else {
        this.marker = L.marker(e.latlng, { icon: customIcon }).addTo(this.map);
      }
    });
  }

  initCameraControls() {
    const openCameraBtn = document.getElementById("open-camera-btn");
    const cameraPreview = document.getElementById("camera-preview");
    const video = document.getElementById("video");
    const captureBtn = document.getElementById("capture-btn");
    const closeCameraBtn = document.getElementById("close-camera-btn");
    const fileInput = document.getElementById("photo");

    openCameraBtn.addEventListener("click", async () => {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = this.stream;
        cameraPreview.style.display = "block";
        openCameraBtn.style.display = "none";
        fileInput.value = "";
      } catch (error) {
        alert("Tidak dapat mengakses kamera: " + error.message);
      }
    });

    captureBtn.addEventListener("click", () => {
      if (!this.stream) return;

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob((blob) => {
        if (!blob) return;

        const file = new File([blob], "captured-image.png", { type: "image/png" });
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;

        this.stream.getTracks().forEach((track) => track.stop());
        this.stream = null;
        cameraPreview.style.display = "none";
        openCameraBtn.style.display = "inline-block";
      }, "image/png");
    });

    closeCameraBtn.addEventListener("click", () => {
      if (this.stream) {
        this.stream.getTracks().forEach((track) => track.stop());
        this.stream = null;
      }
      cameraPreview.style.display = "none";
      openCameraBtn.style.display = "inline-block";
    });
  }

  initFormSubmit() {
    const form = document.getElementById("add-story-form");
    const message = document.getElementById("add-story-message");
    const latInput = document.getElementById("lat");
    const lonInput = document.getElementById("lon");
    const fileInput = document.getElementById("photo");

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      message.textContent = "";

      const description = form.description.value.trim();
      const lat = latInput.value ? parseFloat(latInput.value) : null;
      const lon = lonInput.value ? parseFloat(lonInput.value) : null;
      const photoFile = fileInput.files[0];

      if (!description || !photoFile) {
        message.textContent = "Please provide description and photo.";
        return;
      }

      if (photoFile.size > 1024 * 1024) {
        message.textContent = "Photo size must be less than 1MB.";
        return;
      }

      try {
        const token = localStorage.getItem("token");
        if (!token) {
          message.textContent = "You must be logged in to add a story.";
          return;
        }

        if (!navigator.onLine) {
          // Save story offline in IndexedDB
          const reader = new FileReader();
          reader.onload = async () => {
            const photoDataUrl = reader.result;
            const offlineStory = {
              description,
              lat,
              lon,
              photoDataUrl,
              createdAt: new Date().toISOString(),
            };
            await addStoryToIDB(offlineStory);
            message.textContent = "You are offline. Story saved locally and will be synced when online.";
            setTimeout(() => {
              window.location.hash = "#/";
            }, 2000);
          };
          reader.readAsDataURL(photoFile);
          return;
        }

        const { addNewStory } = await import("../../data/api.js");
        await addNewStory(token, description, photoFile, lat, lon);
        message.textContent = "Story added successfully!";

        if (Notification.permission === "granted") {
          navigator.serviceWorker.getRegistration().then(function(registration) {
            if (registration) {
              registration.showNotification("Story berhasil dibuat", {
                body: `Anda telah membuat story baru dengan deskripsi: ${description}`,
              });
            }
          });
        }

        setTimeout(() => {
          window.location.hash = "#/";
        }, 2000);
      } catch (error) {
        message.textContent = error.message || "Failed to add story.";
      }
    });
  }

  async setupSyncPendingStories() {
    window.addEventListener('online', async () => {
      const token = localStorage.getItem("token");
      if (!token) return;

      const pendingStories = await getAllPendingStoriesFromIDB();
      for (const story of pendingStories) {
        try {
          const { addNewStory } = await import("../../data/api.js");

          // Convert photoDataUrl back to Blob
          const res = await fetch(story.photoDataUrl);
          const blob = await res.blob();
          const file = new File([blob], "offline-photo.png", { type: blob.type });

          await addNewStory(token, story.description, file, story.lat, story.lon);
          await deleteStoryFromIDB(story.id);
        } catch (error) {
          console.error("Failed to sync story", story, error);
        }
      }
    });
  }
}
