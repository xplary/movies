const RENDER_URL = "https://peliapi-8q6q.onrender.com";
const API_BASE = `${RENDER_URL}/api/v1/content`;

const state = {
  activeType: "movie",
  results: [],
  selectedMedia: null,
  heroItems: [],
  heroIndex: 0,
  heroInterval: null,
  serversList: [],
  currentServerIndex: 0
};

const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const filterTabs = document.querySelectorAll(".filter-tab");
const resultsGrid = document.getElementById("results-grid");
const homeView = document.getElementById("home-view");
const gridView = document.getElementById("grid-view");

const theaterModal = document.getElementById("theater-modal");
const theaterTitle = document.getElementById("theater-title");
const theaterLoader = document.getElementById("theater-loader");
const theaterIframe = document.getElementById("theater-iframe");
const serverSelector = document.getElementById("server-selector");
const nextServerBtn = document.getElementById("btn-next-server");
const seasonSelector = document.getElementById("season-selector");
const episodeSelector = document.getElementById("episode-selector");

document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  loadHomepage();
});

function showHomeView() {
  homeView.classList.remove("hidden");
  gridView.classList.add("hidden");
  document.querySelectorAll(".netflix-navbar li").forEach(li => li.classList.remove("active"));
  document.getElementById("nav-item-home").classList.add("active");
  searchInput.value = "";
  
  // Reiniciar rotación de banner si regresa a inicio
  if (state.heroItems.length > 0 && !state.heroInterval) {
    setupHeroRotation(state.heroItems);
  }
}

function showGridView(titleText) {
  homeView.classList.add("hidden");
  gridView.classList.remove("hidden");
  document.getElementById("results-title").textContent = titleText;

  // Pausar banner para ahorrar recursos en la sección de catálogo/búsqueda
  if (state.heroInterval) {
    clearInterval(state.heroInterval);
    state.heroInterval = null;
  }
}

function setupEventListeners() {
  document.getElementById("nav-link-home").addEventListener("click", showHomeView);
  document.getElementById("brand-logo").addEventListener("click", showHomeView);
  
  document.getElementById("btn-close-theater").addEventListener("click", () => {
    theaterModal.classList.add("hidden");
    theaterIframe.src = ""; // Detener video por completo al cerrar
    
    // Reactivar rotación del banner principal al cerrar el reproductor
    if (state.heroItems.length > 0 && !state.heroInterval) {
      setupHeroRotation(state.heroItems);
    }
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

  nextServerBtn.addEventListener("click", () => {
    if (!state.serversList || state.serversList.length === 0) return;
    state.currentServerIndex = (state.currentServerIndex + 1) % state.serversList.length;
    const srv = state.serversList[state.currentServerIndex];
    serverSelector.value = srv.embedUrl || srv.url || srv.link;
    theaterIframe.src = serverSelector.value;
  });
}

// Petición robusta con Timeout
async function apiFetch(endpoint) {
  const url = endpoint === "/health" ? `${RENDER_URL}/health` : `${API_BASE}${endpoint}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    const json = await response.json();
    if (!response.ok || !json.success) throw new Error("API Error");
    return json.data;
  } catch (err) {
    clearTimeout(timeoutId);
    console.error(err);
    throw err;
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
  } catch (err) {
    console.error("Error home:", err);
  }
}

function renderCarousel(container, items, type) {
  container.innerHTML = "";
  items.forEach(item => {
    const card = document.createElement("div");
    card.className = "media-card";
    const poster = item.poster || "https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=400";
    
    card.innerHTML = `
      <div class="poster-wrapper">
        <img src="${poster}" class="poster-img" loading="lazy" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=400';">
        <div class="poster-overlay"><ion-icon name="play-circle-sharp"></ion-icon></div>
        ${item.rating ? `<span class="rating-badge"><ion-icon name="star"></ion-icon>${item.rating}</span>` : ''}
      </div>
      <div class="media-info">
        <h3>${(item.title || '').replace("VER ", "").replace(" Online Gratis HD", "")}</h3>
      </div>
    `;
    card.onclick = () => openTheaterMode(item);
    container.appendChild(card);
  });
}

/* BÚSQUEDA INTELIGENTE CON SINÓNIMOS CRUZADOS */
async function performSearch(query) {
  showGridView(`Búsqueda: "${query}"`);
  document.getElementById("results-loading").classList.remove("hidden");
  resultsGrid.innerHTML = "";
  
  try {
    let cleanQuery = query.trim();
    let queriesToTry = [cleanQuery];
    
    const lowerQ = cleanQuery.toLowerCase();
    if (lowerQ.includes("spiderman") || lowerQ.includes("spider man") || lowerQ.includes("spider-man")) {
      queriesToTry.push("hombre araña");
      queriesToTry.push("spider");
    } else if (lowerQ.includes("hombre araña")) {
      queriesToTry.push("spiderman");
    } else if (lowerQ.includes("batman")) {
      queriesToTry.push("caballero oscuro");
    }

    const promises = queriesToTry.map(q => apiFetch(`/search?s=${encodeURIComponent(q)}`).catch(() => []));
    const resultsArrays = await Promise.all(promises);
    
    const combinedMap = new Map();
    resultsArrays.flat().forEach(item => {
      if (item && item.slug) {
        combinedMap.set(item.slug, item);
      }
    });
    
    const items = Array.from(combinedMap.values());
    document.getElementById("results-loading").classList.add("hidden");
    renderCarousel(resultsGrid, items, "search");
  } catch (err) {
    console.error(err);
    document.getElementById("results-loading").classList.add("hidden");
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
    document.getElementById("results-loading").classList.add("hidden");
  }
}

function setupHeroRotation(items) {
  if (!items || items.length === 0) return;
  state.heroItems = items.slice(0, 5);
  state.heroIndex = 0;
  setupHeroBanner(state.heroItems[0]);
  
  if (state.heroInterval) clearInterval(state.heroInterval);
  state.heroInterval = setInterval(() => {
    state.heroIndex = (state.heroIndex + 1) % state.heroItems.length;
    setupHeroBanner(state.heroItems[state.heroIndex]);
  }, 8000);
}

async function setupHeroBanner(item) {
  const banner = document.getElementById("hero-banner");
  banner.style.backgroundImage = `url('${item.poster || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=1600'}')`;
  document.getElementById("hero-title").textContent = item.title;
  document.getElementById("hero-rating").textContent = item.rating || "N/A";
  document.getElementById("hero-synopsis").textContent = "Haz clic en reproducir para disfrutar de esta sugerencia...";
  document.getElementById("hero-play-btn").onclick = () => openTheaterMode(item);
}

async function openTheaterMode(item) {
  // PAUSAR EL BANNER PRINCIPAL PARA LIBERAR 100% LOS RECURSOS DE LA PÁGINA
  if (state.heroInterval) {
    clearInterval(state.heroInterval);
    state.heroInterval = null;
  }

  theaterModal.classList.remove("hidden");
  theaterLoader.classList.remove("hidden");
  theaterIframe.src = "";
  serverSelector.innerHTML = "";
  seasonSelector.innerHTML = "";
  episodeSelector.innerHTML = "";
  
  serverSelector.classList.add("hidden");
  nextServerBtn.classList.add("hidden");
  seasonSelector.classList.add("hidden");
  episodeSelector.classList.add("hidden");

  const cleanTitle = (item.title || '').replace("VER ", "").replace(" Online Gratis HD", "");
  theaterTitle.textContent = cleanTitle;

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
    console.error("Error al cargar Modo Cine:", err);
    theaterTitle.textContent = "Error al conectar con el servidor.";
    theaterLoader.classList.add("hidden");
  }
}

async function loadEpisodeServers(season, episode) {
  theaterLoader.classList.remove("hidden");
  serverSelector.classList.add("hidden");
  nextServerBtn.classList.add("hidden");
  theaterIframe.src = "";
  
  try {
    const data = await apiFetch(`/servers?slug=${state.selectedMedia.slug}&season=${season}&episode=${episode}&provider=${state.selectedMedia.provider || 'pelisplus'}`);
    autoPlayBestServer(data.servers || []);
  } catch (err) {
    console.error(err);
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
    const nameA = (a.name || '').toLowerCase();
    const nameB = (b.name || '').toLowerCase();
    
    const aClean = nameA.includes('vidhide') || nameA.includes('filelions');
    const bClean = nameB.includes('vidhide') || nameB.includes('filelions');
    
    if (aClean && !bClean) return -1;
    if (!aClean && bClean) return 1;

    const aLat = (a.language || '').toLowerCase().includes('latino');
    const bLat = (b.language || '').toLowerCase().includes('latino');
    if (aLat && !bLat) return -1;
    if (!aLat && bLat) return 1;

    return 0;
  });

  state.serversList = servers;
  state.currentServerIndex = 0;

  serverSelector.innerHTML = "";
  servers.forEach(srv => {
    const opt = document.createElement("option");
    opt.value = srv.embedUrl || srv.url || srv.link;
    opt.textContent = `Servidor: ${srv.name.toUpperCase()} (${srv.language})`;
    serverSelector.appendChild(opt);
  });

  serverSelector.classList.remove("hidden");
  nextServerBtn.classList.remove("hidden");

  serverSelector.onchange = () => {
    const idx = state.serversList.findIndex(s => (s.embedUrl || s.url || s.link) === serverSelector.value);
    if (idx !== -1) state.currentServerIndex = idx;
    theaterIframe.src = serverSelector.value;
  };

  serverSelector.value = servers[0].embedUrl || servers[0].url || servers[0].link;
  theaterIframe.src = serverSelector.value;
  
  theaterLoader.classList.add("hidden");
}
