import HomePresenter from "./home-presenter.js";

export default class HomePage {
  async render() {
    return `
      <section class="container" tabindex="0" aria-label="Home Page">
        <h1>Stories</h1>
        <p>Welcome to Dicoding Stories, the dedicated community platform built exclusively for Dicoding participants. 
        Share your unique learning journeys, celebrate your project successes, and connect with fellow learners from 
        across the archipelago. This is your space to inspire and be inspired by the diverse experiences within the Dicoding community, 
        fostering a supportive environment where everyone's story contributes to our collective growth in the world of technology.
</p>
        <div id="story-list" class="story-grid" aria-live="polite" aria-relevant="additions"></div>
        <button id="next-page-btn" class="btn" aria-label="Load More">Load More</button>
        <div id="map" style="height: 400px; margin-top: 20px;"></div>
      </section>

      <style>
        .container {
          max-width: 1800px;
          margin: 0 auto;
          padding: 20px;
        }

        h1 {
          text-align: center;
          font-size: 36px;
          font-weight: bold;
          color: #333;
          margin-bottom: 40px;
        }

        .btn {
          background-color: #2a9d8f;
          color: #fff;
          padding: 10px 20px;
          margin-top: 20px;
          border: none;
          width: 100%;
          border-radius: 6px;
          font-size: 15px;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }

        .btn:hover {
          background-color: #2a9d8f;
        }

        .btn:focus {
          outline: none;
          border-color: #666;
        }

       
        .story-grid {
          margin-top: 20px;
        }

        .story-card {
          border: 1px solid #ccc;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 15px;
          box-shadow: 0 2px 5px rgba(0,0,0,0.1);
          position: relative;
        }

        .story-card img {
          max-width: 100%;
          border-radius: 6px;
          margin-bottom: 10px;
        }

        .story-card h2 {
          margin: 0 0 10px 0;
          font-size: 20px;
          color: #2a9d8f;
        }

        .story-card p {
          margin: 5px 0;
          color: #555;
        }

        .view-detail-btn, .delete-story-btn {
          background-color: #2a9d8f;
          color: white;
          border: none;
          padding: 8px 12px;
          margin-right: 10px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        .view-detail-btn:hover, .delete-story-btn:hover {
          background-color: #21867a;
        }

        .delete-story-btn {
          background-color: #e63946;
        }

        .delete-story-btn:hover {
          background-color: #b22234;
        }
      </style>
    `;
  }

  async afterRender() {
    this.presenter = new HomePresenter(this);
    await this.presenter.init();
  }

  clearStoryList() {
    const storyList = document.getElementById("story-list");
    storyList.innerHTML = "";
  }

  clearMap() {
    const mapContainer = document.getElementById("map");
    mapContainer.innerHTML = "";
  }

  showLoginPrompt() {
    const storyList = document.getElementById("story-list");
    storyList.innerHTML = "<p>Please login to view stories.</p>";
    const nextPageBtn = document.getElementById("next-page-btn");
    if (nextPageBtn) nextPageBtn.disabled = true;
  }

  renderStories(stories, showDelete = false) {
    const storyList = document.getElementById("story-list");
    storyList.innerHTML = "";
    stories.forEach((story) => {
      const storyCard = document.createElement("div");
      storyCard.classList.add("story-card");
      storyCard.innerHTML = `
        <img src="${story.photoUrl}" alt="Photo of story by ${story.name}" />
        <h2><i class="fas fa-book icon"></i>${story.name}</h2>
        <p>${story.description}</p>
        <p>Created at: ${new Date(story.createdAt).toLocaleString()}</p>
        <button class="view-detail-btn" data-id="${story.id}">View Detail</button>
        ${showDelete ? `<button class="delete-story-btn" id="delete-story-${story.id}">Delete</button>` : ''}
      `;
      storyList.appendChild(storyCard);
    });
  }

  showLoadError() {
    const storyList = document.getElementById("story-list");
    storyList.innerHTML = "<p>Failed to load stories.</p>";
  }

  disableNextPageButton() {
    const nextPageBtn = document.getElementById("next-page-btn");
    if (nextPageBtn) nextPageBtn.disabled = true;
  }

  enableNextPageButton() {
    const nextPageBtn = document.getElementById("next-page-btn");
    if (nextPageBtn) nextPageBtn.disabled = false;
  }

  setNextPageButtonHandler(handler) {
    const nextPageBtn = document.getElementById("next-page-btn");
    if (nextPageBtn) {
      nextPageBtn.removeEventListener("click", this._nextPageHandler);
      this._nextPageHandler = handler;
      nextPageBtn.addEventListener("click", this._nextPageHandler);
    }
  }

  setStoryDetailButtonHandlers(handler) {
    const storyList = document.getElementById("story-list");
    storyList.querySelectorAll(".view-detail-btn").forEach((button) => {
      button.removeEventListener("click", this._storyDetailHandler);
      this._storyDetailHandler = (event) => {
        const id = event.target.getAttribute("data-id");
        handler(id);
      };
      button.addEventListener("click", this._storyDetailHandler);
    });
  }
}
