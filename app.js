// --- CONFIGURACIÓN DE TU SERVIDOR EN LA NUBE ---
const RENDER_URL = "https://peliapi-8q6q.onrender.com";
const API_BASE = `${RENDER_URL}/api/v1/content`;

const state = {
  activeType: "movie",
  results: [],
  selectedMedia: null,
  heroItems: [],
  heroIndex: 0,
  heroInterval: null
};

// DOM Elements Generales
const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const filterTabs = document.querySelectorAll(".filter-tab");
const resultsGrid = document.getElementById("results-grid");
const homeView = document.getElementById("home-view");
const gridView = document.getElementById("grid-view");

// DOM Elements del Modo Cine
const theaterModal = document.getElementById("theater-modal");
const theaterTitle = document.getElementById("theater-title");
const theaterLoader = document.getElementById("theater-loader");
const theaterIframe = document.getElementById("theater-iframe");
const serverSelector = document.getElementById("server-selector");
const seasonSelector = document.getElementById("season-selector");
const episodeSelector = document.getElementById("episode-selector");

// Inicialización
document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  checkBackendStatus();
  loadHomepage();
});

// Navegación
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

// Eventos Base
function setupEventListeners() {
  document.getElementById("nav-link-home").addEventListener("click", showHomeView);
  document.getElementById("brand-logo").addEventListener("click", showHomeView);
  
  // Cerrar Modo Cine
  document.getElementById("btn-close-theater").addEventListener("click", () => {
    theaterModal.classList.add("hidden");
    theaterIframe.src = "";
  });

  // Buscador
  searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (searchInput.value.trim()) performSearch(searchInput.value.trim());
  });

  // Filtros del Navbar
  filterTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const type = tab.getAttribute("data-type");
      state.activeType = type;
      showGridView(`Catálogo: ${type === 'movie' ? 'Películas' : type === 'series' ? 'Series' : 'Anime'}`);
      loadFilteredCatalog(type);
    });
  });
}

// Fetch seguro a tu API
async function apiFetch(endpoint) {
  try {
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

// Estado del Servidor
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

// Cargar Portada
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

// Renderizar Tarjetas
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
    
    // AQUÍ ES LA MAGIA: Al hacer clic, lanza el Modo Cine directamente
    card.onclick = () => openTheaterMode(item);
    container.appendChild(card);
  });
}

// Buscador General
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

// Catálogo por Categoría
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

// Animación del Hero Banner
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
  document.getElementById("hero-synopsis").textContent = "Haz clic en reproducir para disfrutar de esta sugerencia...";
  
  // Reproducción Directa en el Banner
  document.getElementById("hero-play-btn").onclick = () => openTheaterMode(item);
}


// ==========================================
// MODO CINE AUTOMÁTICO (Theater Mode)
// ==========================================

async function openTheaterMode(item) {
  // Limpiar y mostrar modal
  theaterModal.classList.remove("hidden");
  theaterLoader.classList.remove("hidden");
  theaterIframe.src = "";
  serverSelector.innerHTML = "";
  seasonSelector.innerHTML = "";
  episodeSelector.innerHTML = "";
  
  serverSelector.classList.add("hidden");
  seasonSelector.classList.add("hidden");
  episodeSelector.classList.add("hidden");

  // Título Limpio
  const cleanTitle = item.title.replace("VER ", "").replace(" Online Gratis HD", "");
  theaterTitle.textContent = cleanTitle;

  try {
    // 1. Obtener Info Completa (Servidores si es Peli, Temporadas si es Serie)
    const fullInfo = await apiFetch(`/info/${item.slug}?type=${item.type}&provider=${item.provider || ''}`);
    state.selectedMedia = fullInfo;

    if (fullInfo.type === "movie") {
      // ES PELÍCULA
      autoPlayBestServer(fullInfo.servers || []);
    } else {
      // ES SERIE O ANIME
      seasonSelector.classList.remove("hidden");
      episodeSelector.classList.remove("hidden");

      const seasons = fullInfo.seasons || [];
      if (seasons.length === 0) throw new Error("No hay temporadas");

      // Poblar Select de Temporadas
      seasons.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s.number;
        opt.textContent = s.name || `Temporada ${s.number}`;
        seasonSelector.appendChild(opt);
      });

      // Cambio de Temporada
      seasonSelector.onchange = () => {
        const selectedSeason = seasons.find(s => s.number == seasonSelector.value);
        populateEpisodes(selectedSeason.episodes);
      };

      // Poblar Select de Episodios
      function populateEpisodes(episodes) {
        episodeSelector.innerHTML = "";
        episodes.forEach(e => {
          const opt = document.createElement("option");
          opt.value = e.number;
          opt.textContent = `Capítulo ${e.number}`;
          episodeSelector.appendChild(opt);
        });
        
        // Auto-reproducir primer capítulo al cambiar de temporada
        if (episodes.length > 0) {
          episodeSelector.value = episodes[0].number;
          loadEpisodeServers(seasonSelector.value, episodeSelector.value);
        }
      }

      // Cambio de Episodio Manual
      episodeSelector.onchange = () => loadEpisodeServers(seasonSelector.value, episodeSelector.value);

      // ARRANCAR AUTOMÁTICAMENTE T1 C1
      seasonSelector.value = seasons[0].number;
      populateEpisodes(seasons[0].episodes);
    }
  } catch (err) {
    console.error("Error al cargar Modo Cine:", err);
    theaterTitle.textContent = "Error al conectar con el servidor.";
    theaterLoader.classList.add("hidden");
  }
}

// Cargar servidores de un capítulo específico
async function loadEpisodeServers(season, episode) {
  theaterLoader.classList.remove("hidden");
  serverSelector.classList.add("hidden");
  theaterIframe.src = "";
  
  try {
    const data = await apiFetch(`/servers?slug=${state.selectedMedia.slug}&season=${season}&episode=${episode}&provider=${state.selectedMedia.provider || ''}`);
    autoPlayBestServer(data.servers || []);
  } catch (err) {
    console.error(err);
    theaterLoader.classList.add("hidden");
  }
}

// Algoritmo de Auto-Reproducción (Elige Latino por defecto)
function autoPlayBestServer(servers) {
  if (!servers || servers.length === 0) {
    theaterTitle.textContent = "Sin servidores disponibles";
    theaterLoader.classList.add("hidden");
    return;
  }

  // Orden Inteligente: Latino Primero
  servers.sort((a, b) => {
    const aLat = (a.language || '').toLowerCase().includes('latino');
    const bLat = (b.language || '').toLowerCase().includes('latino');
    if (aLat && !bLat) return -1;
    if (!aLat && bLat) return 1;
    return 0;
  });

  // Llenar el Dropdown Superior (Sutil)
  serverSelector.innerHTML = "";
  servers.forEach(srv => {
    const opt = document.createElement("option");
    opt.value = srv.embedUrl || srv.url || srv.link;
    opt.textContent = `Servidor: ${srv.name.toUpperCase()} (${srv.language})`;
    serverSelector.appendChild(opt);
  });

  // Cambio Manual de Servidor
  serverSelector.classList.remove("hidden");
  serverSelector.onchange = () => {
    theaterIframe.src = serverSelector.value;
  };

  // ¡MAGIA! Seleccionar el primero e inyectarlo al Iframe automáticamente
  serverSelector.value = servers[0].embedUrl || servers[0].url || servers[0].link;
  theaterIframe.src = serverSelector.value;
  
  // Ocultar Loader
  theaterLoader.classList.add("hidden");
}
