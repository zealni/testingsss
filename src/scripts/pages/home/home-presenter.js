import L from "leaflet";
import "leaflet/dist/leaflet.css";

import markerIcon from "/src/public/images/marker-icon.png";
import markerShadow from "/src/public/images/marker-shadow.png";

import {
  getAllStories,
} from "../../data/api.js";

import { getAllStories as getAllStoriesFromIDB, addStory as addStoryToIDB, deleteStory as deleteStoryFromIDB } from "../../utils/indexeddb.js";

export default class HomePresenter {
  constructor(view) {
    this.view = view;
    this.currentPage = 1;
    this.pageSize = 20;
    this.map = null;
  }

  async init() {
    this.view.clearStoryList();
    this.view.clearMap();

    const token = localStorage.getItem("token");
    if (!token) {
      this.view.showLoginPrompt();
      return;
    }

    this.setupMap();

    // Load stories from IndexedDB first
    let storedStories = await getAllStoriesFromIDB();
    if (storedStories && storedStories.length > 0) {
      storedStories = storedStories.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      this.view.renderStories(storedStories, true);
      this.addMarkersToMap(storedStories);
      this.attachDeleteHandlers(storedStories);
      this.view.setStoryDetailButtonHandlers((id) => {
        window.location.hash = "#/story/" + id;
      });
    }

    // Fetch fresh stories from API and update IndexedDB, then merge and render all
    await this.loadAndMergeStories(this.currentPage);

    this.view.setNextPageButtonHandler(async () => {
      this.currentPage += 1;
      await this.loadAndMergeStories(this.currentPage);
    });
  }

  setupMap() {
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconUrl: markerIcon,
      shadowUrl: markerShadow,
    });

    this.map = L.map("map").setView([0, 0], 2);

    const osmLayer = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution: "© OpenStreetMap contributors",
      },
    );

    const topoLayer = L.tileLayer(
      "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
      {
        attribution: "© OpenTopoMap contributors",
      },
    );

    const watercolorLayer = L.tileLayer(
      "https://stamen-tiles-{s}.a.ssl.fastly.net/watercolor/{z}/{x}/{y}.jpg",
      {
        attribution: "Map tiles by Stamen Design, under CC BY 3.0.",
      },
    );

    osmLayer.addTo(this.map);

    const baseMaps = {
      OpenStreetMap: osmLayer,
      Topographic: topoLayer,
      Watercolor: watercolorLayer,
    };

    L.control.layers(baseMaps).addTo(this.map);
  }

  async loadAndMergeStories(page) {
    try {
      const token = localStorage.getItem("token");
      const apiResponse = await getAllStories(token, page, this.pageSize, 1);
      const apiStories = apiResponse.listStory || [];

      // Update IndexedDB with fresh API stories
      for (const story of apiStories) {
        await addStoryToIDB(story);
      }

      // Get all stories from IndexedDB (merged)
      let allStories = await getAllStoriesFromIDB();

      // Remove duplicates by id (keep latest)
      const uniqueStoriesMap = new Map();
      allStories.forEach(story => {
        uniqueStoriesMap.set(story.id, story);
      });
      allStories = Array.from(uniqueStoriesMap.values());

      // Sort by createdAt descending
      allStories.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      if (page === 1) {
        this.view.clearStoryList();
        this.clearMapMarkers();
      }

      this.view.renderStories(allStories, true);
      this.addMarkersToMap(allStories);
      this.attachDeleteHandlers(allStories);
      this.view.setStoryDetailButtonHandlers((id) => {
        window.location.hash = "#/story/" + id;
      });

      if (allStories.length > 0) {
        const firstStory = allStories[0];
        if (firstStory.lat !== null && firstStory.lon !== null) {
          this.map.setView([firstStory.lat, firstStory.lon], 5);
        }
      }

      if (apiStories.length < this.pageSize) {
        this.view.disableNextPageButton();
      } else {
        this.view.enableNextPageButton();
      }
    } catch (error) {
      // If API fetch fails, fallback to IndexedDB stories only
      let storedStories = await getAllStoriesFromIDB();
      if (storedStories && storedStories.length > 0) {
        storedStories = storedStories.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        this.view.renderStories(storedStories, true);
        this.addMarkersToMap(storedStories);
        this.attachDeleteHandlers(storedStories);
        this.view.setStoryDetailButtonHandlers((id) => {
          window.location.hash = "#/story/" + id;
        });
      } else {
        this.view.showLoadError();
      }
      console.error(error);
    }
  }

  attachDeleteHandlers(stories) {
    stories.forEach(story => {
      const deleteBtn = document.getElementById("delete-story-" + story.id);
      if (deleteBtn) {
        deleteBtn.addEventListener("click", async () => {
          await deleteStoryFromIDB(story.id);
          // Refresh the list after deletion
          const updatedStories = await getAllStoriesFromIDB();
          this.view.renderStories(updatedStories, true);
          this.addMarkersToMap(updatedStories);
          this.attachDeleteHandlers(updatedStories);
        });
      }
    });
  }

  clearMapMarkers() {
    this.map.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        this.map.removeLayer(layer);
      }
    });
  }

  addMarkersToMap(stories) {

    const customIcon = L.icon({
      iconUrl: markerIcon,
      shadowUrl: markerShadow,
      iconSize: [25, 41], 
      iconAnchor: [12, 41], 
      popupAnchor: [1, -34], 
      shadowSize: [41, 41], 
    });

    stories.forEach((story) => {
      if (story.lat !== null && story.lon !== null) {
        const marker = L.marker([story.lat, story.lon], { icon: customIcon, title: story.name, alt: story.description }).addTo(this.map);
        marker.bindPopup("<strong>" + story.name + "</strong><br />" + story.description + "<br /><img src=\"" + story.photoUrl + "\" alt=\"Photo of story by " + story.name + "\" width=\"150\" />");
      }
    });
  }
}
