class NotFoundPage {
  async render() {
    return `
      <section class="not-found">
        <h2>404 - Page Not Found</h2>
        <p>Maaf, halaman yang Anda cari tidak ditemukan.</p>
      </section>
    `;
  }

  async afterRender() {
    // Any post-render actions can be added here
  }
}

export default NotFoundPage;
