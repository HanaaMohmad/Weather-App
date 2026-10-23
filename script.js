const API_BASE = "https://api.open-meteo.com/v1/forecast";
const GEO_BASE = "https://geocoding-api.open-meteo.com/v1/search";

const $ = (selector) => document.querySelector(selector);
const searchForm = $("#searchForm");
const cityInput = $("#cityInput");
const searchButton = $("#searchButton");
const searchMessage = $("#searchMessage");
const forecastGrid = $("#forecastGrid");
const hourlyList = $("#hourlyList");
const toast = $("#toast");

let temperatureUnit = "celsius";
let latestWeather = null;
let currentPlace = { name: "Cairo", country: "Egypt", latitude: 30.0444, longitude: 31.2357, timezone: "Africa/Cairo" };
let toastTimer;

const weatherDescriptions = {
  0: ["Clear sky", "☀️"],
  1: ["Mainly clear", "🌤️"],
  2: ["Partly cloudy", "⛅"],
  3: ["Overcast", "☁️"],
  45: ["Fog", "🌫️"],
  48: ["Depositing rime fog", "🌫️"],
  51: ["Light drizzle", "🌦️"],
  53: ["Moderate drizzle", "🌦️"],
  55: ["Dense drizzle", "🌧️"],
  56: ["Freezing drizzle", "🌧️"],
  57: ["Heavy freezing drizzle", "🌧️"],
  61: ["Light rain", "🌦️"],
  63: ["Moderate rain", "🌧️"],
  65: ["Heavy rain", "🌧️"],
  66: ["Freezing rain", "🌧️"],
  67: ["Heavy freezing rain", "🌧️"],
  71: ["Light snow", "🌨️"],
  73: ["Moderate snow", "🌨️"],
  75: ["Heavy snow", "❄️"],
  77: ["Snow grains", "🌨️"],
  80: ["Rain showers", "🌦️"],
  81: ["Moderate showers", "🌧️"],
  82: ["Violent showers", "⛈️"],
  85: ["Snow showers", "🌨️"],
  86: ["Heavy snow showers", "❄️"],
  95: ["Thunderstorm", "⛈️"],
  96: ["Thunderstorm with hail", "⛈️"],
  99: ["Severe thunderstorm", "⛈️"]
};

function weatherInfo(code) {
  return weatherDescriptions[code] || ["Variable conditions", "🌤️"];
}

function formatTemp(value, decimals = 0) {
  if (!Number.isFinite(value)) return "--";
  const converted = temperatureUnit === "fahrenheit" ? (value * 9 / 5) + 32 : value;
  return `${Math.round(converted * (decimals ? 10 : 1)) / (decimals ? 10 : 1)}°`;
}

function formatSpeed(value) {
  if (!Number.isFinite(value)) return "-- km/h";
  return `${Math.round(value)} km/h`;
}

function dateLabel(dateString, options = { weekday: "short", month: "short", day: "numeric" }) {
  return new Intl.DateTimeFormat("en-US", options).format(new Date(`${dateString}T12:00:00`));
}

function localHourLabel(dateString) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric" }).format(new Date(dateString));
}

function setMessage(message = "", isError = false) {
  searchMessage.textContent = message;
  searchMessage.style.color = isError ? "#ffe0e0" : "#e3eaff";
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function setLoading(isLoading) {
  searchButton.disabled = isLoading;
  searchButton.innerHTML = isLoading ? "Loading…" : 'Search <span aria-hidden="true">→</span>';
  if (isLoading) {
    forecastGrid.innerHTML = '<div class="loading-card">Finding the latest forecast…</div>';
    hourlyList.innerHTML = '<div class="loading-card">Loading hourly weather…</div>';
  }
}

async function geocodeCity(query) {
  const url = `${GEO_BASE}?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not search for that city right now.");
  const data = await response.json();
  if (!data.results || !data.results.length) throw new Error("We couldn't find that city. Check the spelling and try again.");
  const place = data.results[0];
  return {
    name: place.name,
    country: place.country || place.country_code || "",
    latitude: place.latitude,
    longitude: place.longitude,
    timezone: place.timezone || "auto",
    admin1: place.admin1 || ""
  };
}

async function fetchWeather(place) {
  const params = new URLSearchParams({
    latitude: place.latitude,
    longitude: place.longitude,
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m",
    hourly: "temperature_2m,weather_code,precipitation_probability",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,uv_index_max,sunrise,sunset",
    timezone: place.timezone || "auto",
    forecast_days: "5",
    forecast_hours: "24",
    temperature_unit: "celsius",
    wind_speed_unit: "kmh"
  });
  const response = await fetch(`${API_BASE}?${params.toString()}`);
  if (!response.ok) throw new Error("Weather data is temporarily unavailable. Please try again.");
  return response.json();
}

function renderCurrent(place, data) {
  const current = data.current;
  const daily = data.daily;
  const [description, icon] = weatherInfo(current.weather_code);
  $("#currentCity").textContent = [place.name, place.country].filter(Boolean).join(", ");
  $("#currentDate").textContent = new Intl.DateTimeFormat("en-US", {
    weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    timeZone: data.timezone
  }).format(new Date());
  $("#currentIcon").textContent = icon;
  $("#currentTemp").textContent = formatTemp(current.temperature_2m).replace("°", "");
  $(".degree").textContent = "°";
  $("#currentCondition").textContent = description;
  $("#todayHigh").textContent = formatTemp(daily.temperature_2m_max[0]);
  $("#todayLow").textContent = formatTemp(daily.temperature_2m_min[0]);
  $("#humidity").textContent = `${current.relative_humidity_2m}%`;
  $("#windSpeed").textContent = formatSpeed(current.wind_speed_10m);
  $("#feelsLike").textContent = formatTemp(current.apparent_temperature);
  $("#cloudCover").textContent = `${current.cloud_cover}%`;
  $("#windDirection").textContent = `${Math.round(current.wind_direction_10m)}°`;
  $("#uvIndex").textContent = Number.isFinite(daily.uv_index_max[0]) ? daily.uv_index_max[0].toFixed(1) : "--";
  $("#pressure").textContent = `${Math.round(current.pressure_msl)} hPa`;
  const visibilityIndex = data.hourly?.time?.findIndex(time => time >= current.time) ?? -1;
  const visibility = data.hourly?.visibility?.[visibilityIndex];
  $("#visibility").textContent = Number.isFinite(visibility) ? `${(visibility / 1000).toFixed(1)} km` : "Not available";
}

function renderForecast(data) {
  const daily = data.daily;
  forecastGrid.innerHTML = daily.time.map((date, index) => {
    const [condition, icon] = weatherInfo(daily.weather_code[index]);
    const day = index === 0 ? "Today" : dateLabel(date, { weekday: "short" });
    return `
      <article class="forecast-card" style="animation-delay:${index * 65}ms">
        <div class="forecast-day">${day}</div>
        <div class="forecast-date">${dateLabel(date, { month: "short", day: "numeric" })}</div>
        <span class="forecast-icon" aria-hidden="true">${icon}</span>
        <div class="forecast-temperatures">${formatTemp(daily.temperature_2m_max[index])} <span>/ ${formatTemp(daily.temperature_2m_min[index])}</span></div>
        <p class="forecast-condition">${condition}</p>
      </article>`;
  }).join("");
}

function renderHourly(data) {
  const hourly = data.hourly;
  const currentTime = data.current.time;
  let start = hourly.time.findIndex(time => time >= currentTime);
  if (start < 0) start = 0;
  const items = hourly.time.slice(start, start + 6);
  hourlyList.innerHTML = items.map((time, offset) => {
    const index = start + offset;
    const [condition, icon] = weatherInfo(hourly.weather_code[index]);
    const chance = hourly.precipitation_probability?.[index];
    return `
      <div class="hour-card" title="${condition}">
        <div class="hour-time">${offset === 0 ? "Now" : localHourLabel(time)}</div>
        <span class="hour-icon" aria-hidden="true">${icon}</span>
        <div class="hour-temp">${formatTemp(hourly.temperature_2m[index])}</div>
        <div class="hour-rain">💧 ${Number.isFinite(chance) ? chance : 0}%</div>
      </div>`;
  }).join("");
}

async function loadCity(place, showStatus = true) {
  setLoading(true);
  if (showStatus) setMessage(`Loading weather for ${place.name}…`);
  try {
    const data = await fetchWeather(place);
    currentPlace = place;
    latestWeather = data;
    renderCurrent(place, data);
    renderForecast(data);
    renderHourly(data);
    setMessage("");
    cityInput.value = "";
  } catch (error) {
    setMessage(error.message || "Something went wrong. Please try again.", true);
    showToast(error.message || "Unable to load weather.");
  } finally {
    setLoading(false);
  }
}

searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = cityInput.value.trim();
  if (!query) {
    setMessage("Please enter a city name.", true);
    cityInput.focus();
    return;
  }
  setLoading(true);
  setMessage(`Searching for ${query}…`);
  try {
    const place = await geocodeCity(query);
    await loadCity(place, false);
  } catch (error) {
    setMessage(error.message || "We couldn't find that city.", true);
    showToast(error.message || "Search failed.");
    setLoading(false);
  }
});

document.querySelectorAll("[data-city]").forEach((button) => {
  button.addEventListener("click", async () => {
    const city = button.dataset.city;
    cityInput.value = city;
    try {
      setLoading(true);
      const place = await geocodeCity(`${city}, Egypt`);
      await loadCity(place);
      $("#home").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      setLoading(false);
      setMessage(error.message, true);
    }
  });
});

$("#locationButton").addEventListener("click", () => {
  if (!navigator.geolocation) {
    showToast("Your browser doesn't support location services.");
    return;
  }
  setMessage("Getting your location…");
  navigator.geolocation.getCurrentPosition(async (position) => {
    const coords = {
      name: "Your location",
      country: "",
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      timezone: "auto"
    };
    await loadCity(coords);
  }, () => {
    setMessage("Location access was unavailable. You can search for a city instead.", true);
  }, { enableHighAccuracy: false, timeout: 10000 });
});

$("#themeToggle").addEventListener("click", () => {
  const isDark = document.body.classList.toggle("dark");
  $("#themeToggle").textContent = isDark ? "☀" : "☾";
  $("#themeToggle").setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");
});

$("#unitToggle").addEventListener("click", () => {
  temperatureUnit = temperatureUnit === "celsius" ? "fahrenheit" : "celsius";
  $("#unitToggle").textContent = temperatureUnit === "celsius" ? "°C" : "°F";
  if (latestWeather) {
    renderCurrent(currentPlace, latestWeather);
    renderForecast(latestWeather);
    renderHourly(latestWeather);
  }
  showToast(`Temperature unit changed to ${temperatureUnit === "celsius" ? "Celsius" : "Fahrenheit"}.`);
});

document.querySelectorAll(".nav-link").forEach((link) => {
  link.addEventListener("click", () => {
    document.querySelectorAll(".nav-link").forEach(item => item.classList.remove("active"));
    link.classList.add("active");
  });
});

loadCity(currentPlace, false);
