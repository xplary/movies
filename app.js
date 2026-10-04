const RENDER_URL = "https://peliapi-8q6q.onrender.com";
const API_BASE = `${RENDER_URL}/api/v1/content`;

const state = { activeType: "movie", results: [], selectedMedia: null, heroItems: [], heroIndex: 0, heroInterval: null };
let customPlayer = null; // Instancia global del reproductor
let hlsInstance = null; // Instancia global de HLS

// DOM Elements
const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const filterTabs = document.querySelectorAll(".filter-tab");
const resultsGrid = document.getElementById("results-grid");
const homeView = document.getElementById("home-view");
const gridView = document.getElementById("grid-view");

const theaterModal = document.getElementById("theater-modal");
const theaterTitle = document.getElementById("theater-title");
const theaterLoader = document.getElementById("theater-loader");
const loaderText = document.getElementById("loader-text");
const serverSelector = document.getElementById("server-selector");
const seasonSelector = document.getElementById("season-selector");
const episodeSelector = document.getElementById("episode-selector");
const videoContainer = document.getElementById("video-container");
const iframeContainer = document.getElementById("iframe-container");
const theaterVideo = document.getElementById("theater-video");
const theaterIframe = document.getElementById("theater-iframe");

// Init
document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  checkBackendStatus();
  loadHomepage();
});

// Navegación Básica
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

// Eventos
function setupEventListeners() {
  document.getElementById("nav-link-home").addEventListener("click", showHomeView);
  document.getElementById("brand-logo").addEventListener("click", showHomeView);
  
  // Cerrar Modo Cine y destruir reproductor
  document.getElementById("btn-close-theater").addEventListener("click", () => {
    theaterModal.classList.add("hidden");
    if (customPlayer) { customPlayer.destroy(); customPlayer = null; }
    if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
    theaterIframe.src = "";
    theaterVideo.src = "";
  });

  searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (searchInput.value.trim()) performSearch(searchInput.value.trim());
  });

  filterTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const type = tab.getAttribute("data-type");
      state.activeType = type;
      showGridView(`Catálogo: ${type === 'movie' ? 'Películas' : type === 'series' ? 'Series' : 'Anime'}`);
      loadFilteredCatalog(type);
    });
  });
}

async function apiFetch(endpoint) {
  try {
    const url = endpoint.startsWith("/resolve") || endpoint.startsWith("/health") 
                ? `${RENDER_URL}${endpoint}` 
                : `${API_BASE}${endpoint}`;
    const response = await fetch(url);
    const json = await response.json();
    if (!response.ok || !json.success) throw new Error("API Error");
    return json.data || json; // Resolve API a veces devuelve directo el objeto
  } catch (err) {
    console.error(err);
    throw err;
  }
}

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

async function loadHomepage() {
  try {
    const [moviesData, seriesData, animeData] = await Promise.all([
      apiFetch("/catalog?type=movie&page=1").catch(() => null),
      apiFetch("/catalog?type=series&page=1").catch(() => null),
      apiFetch("/catalog?type=anime&page=1").catch(() => null)
    ]);
    
    renderCarousel(document.getElementById("carousel-movies"), moviesData?.items || [], "movie");
    renderCarousel(document.getElementById("carousel-series"), seriesData?.items || [], "series");
    renderCarousel(document.getElementById("carousel-anime"), animeData?.items || [], "anime");
    
    const allHeroCandidates = [...(moviesData?.items||[]), ...(seriesData?.items||[])].filter(i => parseFloat(i.rating) >= 7.5);
    setupHeroRotation(allHeroCandidates);
  } catch (err) { console.error(err); }
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
    card.onclick = () => openTheaterMode(item);
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
  } catch (err) { console.error(err); }
}

async function loadFilteredCatalog(type) {
  document.getElementById("results-loading").classList.remove("hidden");
  resultsGrid.innerHTML = "";
  try {
    const data = await apiFetch(`/catalog?type=${type}&page=1`);
    document.getElementById("results-loading").classList.add("hidden");
    renderCarousel(resultsGrid, data.items || [], type);
  } catch (err) { console.error(err); }
}

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
  document.getElementById("hero-play-btn").onclick = () => openTheaterMode(item);
}

// ==========================================
// MODO CINE & REPRODUCTOR NATIVO
// ==========================================

async function openTheaterMode(item) {
  theaterModal.classList.remove("hidden");
  theaterLoader.classList.remove("hidden");
  loaderText.textContent = "Buscando capítulos...";
  
  videoContainer.classList.add("hidden");
  iframeContainer.classList.add("hidden");
  serverSelector.innerHTML = "";
  seasonSelector.innerHTML = "";
  episodeSelector.innerHTML = "";
  serverSelector.classList.add("hidden");
  seasonSelector.classList.add("hidden");
  episodeSelector.classList.add("hidden");

  theaterTitle.textContent = item.title.replace("VER ", "").replace(" Online Gratis HD", "");

  try {
    const fullInfo = await apiFetch(`/info/${item.slug}?type=${item.type}&provider=${item.provider || 'pelisplus'}`);
    state.selectedMedia = fullInfo;

    if (fullInfo.type === "movie") {
      autoPlayBestServer(fullInfo.servers || []);
    } else {
      seasonSelector.classList.remove("hidden");
      episodeSelector.classList.remove("hidden");

      const seasons = fullInfo.seasons || [];
      if (seasons.length === 0) throw new Error("No hay temporadas");

      seasons.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s.number;
        opt.textContent = s.name || `Temporada ${s.number}`;
        seasonSelector.appendChild(opt);
      });

      seasonSelector.onchange = () => {
        const selectedSeason = seasons.find(s => s.number == seasonSelector.value);
        populateEpisodes(selectedSeason.episodes);
      };

      function populateEpisodes(episodes) {
        episodeSelector.innerHTML = "";
        episodes.forEach(e => {
          const opt = document.createElement("option");
          opt.value = e.number;
          opt.textContent = `Capítulo ${e.number}`;
          episodeSelector.appendChild(opt);
        });
        if (episodes.length > 0) {
          episodeSelector.value = episodes[0].number;
          loadEpisodeServers(seasonSelector.value, episodeSelector.value);
        }
      }

      episodeSelector.onchange = () => loadEpisodeServers(seasonSelector.value, episodeSelector.value);
      seasonSelector.value = seasons[0].number;
      populateEpisodes(seasons[0].episodes);
    }
  } catch (err) {
    theaterTitle.textContent = "Error al conectar con el servidor.";
    theaterLoader.classList.add("hidden");
  }
}

async function loadEpisodeServers(season, episode) {
  theaterLoader.classList.remove("hidden");
  serverSelector.classList.add("hidden");
  videoContainer.classList.add("hidden");
  iframeContainer.classList.add("hidden");
  
  try {
    const data = await apiFetch(`/servers?slug=${state.selectedMedia.slug}&season=${season}&episode=${episode}&provider=${state.selectedMedia.provider || 'pelisplus'}`);
    autoPlayBestServer(data.servers || []);
  } catch (err) {
    theaterLoader.classList.add("hidden");
  }
}

function autoPlayBestServer(servers) {
  if (!servers || servers.length === 0) {
    theaterTitle.textContent = "Sin servidores disponibles";
    theaterLoader.classList.add("hidden");
    return;
  }

  servers.sort((a, b) => {
    const aLat = (a.language || '').toLowerCase().includes('latino');
    const bLat = (b.language || '').toLowerCase().includes('latino');
    if (aLat && !bLat) return -1;
    if (!aLat && bLat) return 1;
    return 0;
  });

  serverSelector.innerHTML = "";
  servers.forEach(srv => {
    const opt = document.createElement("option");
    opt.value = srv.embedUrl || srv.url || srv.link;
    opt.textContent = `Servidor: ${srv.name.toUpperCase()} (${srv.language})`;
    serverSelector.appendChild(opt);
  });

  serverSelector.classList.remove("hidden");
  serverSelector.onchange = () => attemptDirectPlay(serverSelector.value);
  
  // Autoplay del primer servidor
  serverSelector.value = servers[0].embedUrl || servers[0].url || servers[0].link;
  attemptDirectPlay(serverSelector.value);
}

// Lógica principal: Resolver el Iframe a MP4/M3U8 y reproducirlo nativamente
async function attemptDirectPlay(iframeUrl) {
  theaterLoader.classList.remove("hidden");
  loaderText.textContent = "Desencriptando video en alta calidad...";
  videoContainer.classList.add("hidden");
  iframeContainer.classList.add("hidden");

  // Destruir instancia anterior
  if (customPlayer) { customPlayer.destroy(); customPlayer = null; }
  if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
  theaterVideo.src = "";
  theaterIframe.src = "";

  try {
    // Llama a la API de Render para extraer el video crudo
    const resolved = await apiFetch(`/api/v1/content/resolve?url=${encodeURIComponent(iframeUrl)}`);
    const rawUrl = resolved.url || resolved.source || resolved.stream;

    if (!rawUrl) throw new Error("No se pudo extraer enlace directo");

    // Éxito: Inicializar reproductor propio
    theaterLoader.classList.add("hidden");
    videoContainer.classList.remove("hidden");

    if (Hls.isSupported() && rawUrl.includes('.m3u8')) {
      hlsInstance = new Hls();
      hlsInstance.loadSource(rawUrl);
      hlsInstance.attachMedia(theaterVideo);
      hlsInstance.on(Hls.Events.MANIFEST_PARSED, function() {
        customPlayer = new Plyr(theaterVideo, { autoplay: true });
        customPlayer.play();
      });
    } else {
      theaterVideo.src = rawUrl;
      customPlayer = new Plyr(theaterVideo, { autoplay: true });
      customPlayer.play();
    }
  } catch (err) {
    console.warn("Fallo el extractor nativo, usando Iframe de respaldo", err);
    // Fallback: Si el extractor falla (ej. servidor muy nuevo), carga el iframe tradicional
    theaterLoader.classList.add("hidden");
    iframeContainer.classList.remove("hidden");
    theaterIframe.src = iframeUrl;
  }
}
