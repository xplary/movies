// --- CONFIGURACIÓN DE TU SERVIDOR EN LA NUBE ---
const RENDER_URL = "https://peliapi-8q6q.onrender.com";
const API_BASE = `${RENDER_URL}/api/v1/content`;

const state = {
  activeType: "movie",
  results: [],
  selectedMedia: null,
  activeSeason: 1,
  activeEpisode: 1,
  filters: { type: 'all', genre: '', minRating: 0, sortBy: 'default' },
  genres: [],
  currentPage: 1,
  heroItems: [],
  heroIndex: 0,
  heroInterval: null
};

// DOM Elements
const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const filterTabs = document.querySelectorAll(".filter-tab");
const resultsGrid = document.getElementById("results-grid");
const homeView = document.getElementById("home-view");
const gridView = document.getElementById("grid-view");
const detailsPanel = document.getElementById("details-panel");
const videoPlayerContainer = document.getElementById("video-player-container");
const playerIframe = document.getElementById("player-iframe");

// Init
document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  checkBackendStatus();
  loadHomepage();
});

// SPA Navigation
function showHomeView() {
  homeView.classList.remove("hidden");
  gridView.classList.add("hidden");
  document.querySelectorAll(".netflix-navbar li").forEach(li => li.classList.remove("active"));
  document.getElementById("nav-item-home").classList.add("active");
  searchInput.value = "";
}

function showGridView(titleText) {
  homeView.classList.add("hidden");
  gridView.classList.remove("hidden");
  document.getElementById("results-title").textContent = titleText;
}

function closeDetailsModal() {
  detailsPanel.classList.add("hidden");
  playerIframe.src = "";
  videoPlayerContainer.classList.add("hidden");
}

function setupEventListeners() {
  document.getElementById("nav-link-home").addEventListener("click", showHomeView);
  document.getElementById("brand-logo").addEventListener("click", showHomeView);
  document.getElementById("modal-backdrop-close").addEventListener("click", closeDetailsModal);
  document.getElementById("btn-close-modal").addEventListener("click", closeDetailsModal);
  document.getElementById("close-player-btn").addEventListener("click", () => {
    videoPlayerContainer.classList.add("hidden");
    playerIframe.src = "";
  });

  searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (searchInput.value.trim()) performSearch(searchInput.value.trim());
  });

  filterTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const type = tab.getAttribute("data-type");
      state.activeType = type;
      showGridView(`Catálogo: ${type}`);
      loadFilteredCatalog(type);
    });
  });
}

// Custom Fetch apuntando a Render
async function apiFetch(endpoint) {
  try {
    // Si es /health, usa la ruta base, sino usa API_BASE
    const url = endpoint === "/health" ? `${RENDER_URL}/health` : `${API_BASE}${endpoint}`;
    const response = await fetch(url);
    const json = await response.json();
    if (!response.ok || !json.success) throw new Error("API Error");
    return json.data;
  } catch (err) {
    console.error(err);
    throw err;
  }
}

// Health Check
async function checkBackendStatus() {
  const badge = document.getElementById("status-badge");
  try {
    const data = await apiFetch("/health");
    if (data && data.status === "ok") {
      badge.className = "api-status-badge online";
      badge.querySelector(".status-text").textContent = "Online";
    }
  } catch (err) {
    badge.className = "api-status-badge offline";
    badge.querySelector(".status-text").textContent = "Offline";
  }
}

// Cargar Inicio
async function loadHomepage() {
  try {
    const [moviesData, seriesData, animeData] = await Promise.all([
      apiFetch("/catalog?type=movie").catch(() => null),
      apiFetch("/catalog?type=series").catch(() => null),
      apiFetch("/catalog?type=anime").catch(() => null)
    ]);
    
    renderCarousel(document.getElementById("carousel-movies"), moviesData?.items || [], "movie");
    renderCarousel(document.getElementById("carousel-series"), seriesData?.items || [], "series");
    renderCarousel(document.getElementById("carousel-anime"), animeData?.items || [], "anime");
    
    const allHeroCandidates = [...(moviesData?.items||[]), ...(seriesData?.items||[])].filter(i => parseFloat(i.rating) >= 7.5);
    setupHeroRotation(allHeroCandidates);
  } catch (err) {
    console.error("Error home:", err);
  }
}

function renderCarousel(container, items, type) {
  container.innerHTML = "";
  items.forEach(item => {
    const card = document.createElement("div");
    card.className = "media-card";
    const poster = item.poster || "https://via.placeholder.com/200x300";
    card.innerHTML = `
      <div class="poster-wrapper">
        <img src="${poster}" class="poster-img" loading="lazy">
        <div class="poster-overlay"><ion-icon name="play-circle-sharp"></ion-icon></div>
        ${item.rating ? `<span class="rating-badge"><ion-icon name="star"></ion-icon>${item.rating}</span>` : ''}
      </div>
      <div class="media-info">
        <h3>${item.title.replace("VER ", "").replace(" Online Gratis HD", "")}</h3>
      </div>
    `;
    card.onclick = () => loadMediaDetails(item);
    container.appendChild(card);
  });
}

async function performSearch(query) {
  showGridView(`Búsqueda: "${query}"`);
  document.getElementById("results-loading").classList.remove("hidden");
  resultsGrid.innerHTML = "";
  try {
    const items = await apiFetch(`/search?s=${encodeURIComponent(query)}`);
    document.getElementById("results-loading").classList.add("hidden");
    renderCarousel(resultsGrid, items || [], "search");
  } catch (err) {
    console.error(err);
  }
}

async function loadFilteredCatalog(type) {
  document.getElementById("results-loading").classList.remove("hidden");
  resultsGrid.innerHTML = "";
  try {
    const data = await apiFetch(`/catalog?type=${type}&page=1`);
    document.getElementById("results-loading").classList.add("hidden");
    renderCarousel(resultsGrid, data.items || [], type);
  } catch (err) {
    console.error(err);
  }
}

// Hero Banner Logic
function setupHeroRotation(items) {
  if (!items || items.length === 0) return;
  state.heroItems = items.slice(0, 5);
  state.heroIndex = 0;
  setupHeroBanner(state.heroItems[0]);
  setInterval(() => {
    state.heroIndex = (state.heroIndex + 1) % state.heroItems.length;
    setupHeroBanner(state.heroItems[state.heroIndex]);
  }, 8000);
}

async function setupHeroBanner(item) {
  const banner = document.getElementById("hero-banner");
  banner.style.backgroundImage = `url('${item.poster}')`;
  document.getElementById("hero-title").textContent = item.title;
  document.getElementById("hero-rating").textContent = item.rating || "N/A";
  
  document.getElementById("hero-play-btn").onclick = () => loadMediaDetails(item);
  document.getElementById("hero-info-btn").onclick = () => loadMediaDetails(item);
}

// Modal y Servidores
async function loadMediaDetails(item) {
  detailsPanel.classList.remove("hidden");
  document.getElementById("details-poster").src = item.poster;
  document.getElementById("details-title").textContent = item.title;
  document.getElementById("details-synopsis").textContent = "Cargando...";
  document.getElementById("servers-container").innerHTML = "";
  document.getElementById("seasons-section").classList.add("hidden");
  
  try {
    const fullInfo = await apiFetch(`/info/${item.slug}?type=${item.type}&provider=${item.provider || ''}`);
    state.selectedMedia = fullInfo;
    document.getElementById("details-synopsis").textContent = fullInfo.synopsis || "Sin sinopsis.";
    
    if (fullInfo.type === "movie") {
      renderServers(fullInfo.servers || []);
    } else {
      document.getElementById("seasons-section").classList.remove("hidden");
      renderSeasonsTabs(fullInfo.seasons || []);
    }
  } catch (err) {
    console.error(err);
  }
}

function renderSeasonsTabs(seasons) {
  const container = document.getElementById("seasons-tabs-container");
  container.innerHTML = "";
  seasons.forEach((s, i) => {
    const btn = document.createElement("button");
    btn.className = `season-tab ${i === 0 ? "active" : ""}`;
    btn.textContent = s.name || `Temp ${s.number}`;
    btn.onclick = () => {
      document.querySelectorAll(".season-tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.activeSeason = s.number;
      renderEpisodes(s.episodes || []);
    };
    container.appendChild(btn);
  });
  if (seasons.length > 0) renderEpisodes(seasons[0].episodes || []);
}

function renderEpisodes(episodes) {
  const container = document.getElementById("episodes-container");
  container.innerHTML = "";
  episodes.forEach((e, i) => {
    const btn = document.createElement("button");
    btn.className = `episode-btn ${i === 0 ? "active" : ""}`;
    btn.textContent = e.number;
    btn.onclick = () => {
      document.querySelectorAll(".episode-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.activeEpisode = e.number;
      fetchEpisodeServers(e);
    };
    container.appendChild(btn);
  });
  if (episodes.length > 0) fetchEpisodeServers(episodes[0]);
}

async function fetchEpisodeServers(episode) {
  document.getElementById("servers-container").innerHTML = "<p>Buscando servidores...</p>";
  try {
    const data = await apiFetch(`/servers?slug=${state.selectedMedia.slug}&season=${state.activeSeason}&episode=${episode.number}&provider=${state.selectedMedia.provider || ''}`);
    renderServers(data.servers || []);
  } catch (err) {
    document.getElementById("servers-container").innerHTML = "<p>Error de servidores</p>";
  }
}

function renderServers(servers) {
  const container = document.getElementById("servers-container");
  container.innerHTML = "";
  if (servers.length === 0) {
    container.innerHTML = "<p>No hay servidores disponibles.</p>";
    return;
  }
  
  servers.forEach(server => {
    const row = document.createElement("div");
    row.className = "server-row";
    row.innerHTML = `
      <div class="server-info">
        <span style="font-weight: bold; color: white;">${server.name.toUpperCase()}</span>
        <span style="color: #e50914; font-size: 12px; margin-left: 10px;">${server.language}</span>
      </div>
      <button class="btn-action play">▶ Ver</button>
    `;
    row.querySelector(".play").onclick = () => {
      document.getElementById("player-iframe").src = server.embedUrl || server.url || server.link;
      document.getElementById("video-player-container").classList.remove("hidden");
    };
    container.appendChild(row);
  });
}