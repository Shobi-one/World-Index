const CATEGORY_META = {
  clans: {
    label: "Clans",
    description: "Bloodlines, allegiances, and rivalries forged in dust and iron.",
  },
  towns: {
    label: "Towns",
    description: "Settlements, trade hubs, and frontier outposts.",
  },
  mesas: {
    label: "Mesas",
    description: "Highland formations, shrines, and dangerous overlooks.",
  },
  regions: {
    label: "Regions",
    description: "Major territories that shape climate, politics, and war.",
  },
};

function setActiveNav() {
  const page = document.body.dataset.page;
  const navLinks = document.querySelectorAll("[data-nav]");
  navLinks.forEach((link) => {
    if (link.dataset.nav === page) {
      link.setAttribute("aria-current", "page");
    }
  });
}

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

async function loadJson(file) {
  const response = await fetch(`data/${file}.json`);
  if (!response.ok) {
    throw new Error(`Failed to load data/${file}.json`);
  }
  return response.json();
}

function excerptFromBody(body, max = 160) {
  if (!body) {
    return "";
  }

  const plainText = String(body)
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[*-]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();

  if (plainText.length <= max) {
    return plainText;
  }

  return `${plainText.slice(0, max).trim()}...`;
}

function tagsToString(tags) {
  if (!tags) {
    return "";
  }

  if (Array.isArray(tags)) {
    return tags.join(" | ");
  }

  return String(tags);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatMetaLabel(key) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeText(value) {
  return String(value || "").toLowerCase();
}

function toSearchableText(record) {
  return Object.entries(record)
    .filter(([key]) => !["bodyHtml"].includes(key))
    .flatMap(([, value]) => {
      if (Array.isArray(value)) {
        return value;
      }

      return value == null ? [] : [value];
    })
    .join(" ")
    .toLowerCase();
}

function uniqueValues(records, key) {
  return [...new Set(records.map((record) => record[key]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

function createFilterPanel(container, fields, summaryText = "") {
  container.innerHTML = `
    <div class="filter-grid">
      ${fields.join("")}
    </div>
    <p class="filter-summary" data-filter-summary>${escapeHtml(summaryText)}</p>
  `;
}

function renderCards(records, options = {}) {
  const {
    kind = "world",
    titleKey = "name",
    metaBuilder,
    linkBuilder,
  } = options;

  if (!records.length) {
    return '<div class="empty-state">No records found yet.</div>';
  }

  return `<div class="grid">${records
    .map((record) => {
      const title = record[titleKey] || record.name || record.slug;
      const meta = metaBuilder ? metaBuilder(record) : tagsToString(record.tags);
      const excerpt = excerptFromBody(record.body);
      const link = linkBuilder ? linkBuilder(record) : `category.html?type=${kind}&slug=${record.slug}`;
      return `<article class="card">
        <h3>${escapeHtml(title)}</h3>
        ${meta ? `<p class="meta">${escapeHtml(meta)}</p>` : ""}
        <p class="excerpt">${escapeHtml(excerpt)}</p>
        <p><a href="${link}">View Entry</a></p>
      </article>`;
    })
    .join("")}</div>`;
}

function renderError(container, message) {
  container.innerHTML = `<div class="error-state">${escapeHtml(message)}</div>`;
}

async function renderHomePage() {
  const target = document.getElementById("home-metrics");
  try {
    const manifest = await loadJson("manifest");
    const counts = manifest.counts || {};
    const rows = [
      ["Characters", counts.characters || 0],
      ["Clans", counts.clans || 0],
      ["Towns", counts.towns || 0],
      ["Mesas", counts.mesas || 0],
      ["Regions", counts.regions || 0],
    ];

    target.innerHTML = rows
      .map(
        ([label, value]) => `<article class="metric"><span class="value">${value}</span><span>${label}</span></article>`
      )
      .join("");
  } catch (error) {
    renderError(target, "Run npm run build:content to generate data files.");
  }
}

function renderWorldTiles() {
  const target = document.getElementById("world-tiles");
  const links = Object.entries(CATEGORY_META)
    .map(
      ([key, info]) => `<a class="category-tile" href="category.html?type=${key}">
          <h3>${escapeHtml(info.label)}</h3>
          <p>${escapeHtml(info.description)}</p>
          <p><strong>Open ${escapeHtml(info.label)}</strong></p>
        </a>`
    )
    .join("");

  target.innerHTML = `<div class="category-tiles">${links}</div>`;
}

async function renderCharactersPage() {
  const controls = document.getElementById("character-controls");
  const target = document.getElementById("character-list");
  try {
    const characters = await loadJson("characters");

    const clanOptions = uniqueValues(characters, "clan");
    createFilterPanel(
      controls,
      [
        `<label class="filter-field"><span>Search</span><input data-character-search type="search" placeholder="Search name, title, clan, tags..." /></label>`,
        `<label class="filter-field"><span>Clan</span><select data-character-clan><option value="">All Clans</option>${clanOptions.map((clan) => `<option value="${escapeHtml(clan)}">${escapeHtml(clan)}</option>`).join("")}</select></label>`,
      ],
      `${characters.length} dossiers available`
    );

    const searchInput = controls.querySelector("[data-character-search]");
    const clanSelect = controls.querySelector("[data-character-clan]");
    const summary = controls.querySelector("[data-filter-summary]");

    const render = () => {
      const query = normalizeText(searchInput.value);
      const clan = clanSelect.value;

      const filtered = characters.filter((character) => {
        const matchesSearch = !query || toSearchableText(character).includes(query);
        const matchesClan = !clan || character.clan === clan;
        return matchesSearch && matchesClan;
      });

      summary.textContent = `${filtered.length} of ${characters.length} dossiers shown`;

      target.innerHTML = renderCards(filtered, {
        titleKey: "name",
        metaBuilder: (record) => `${record.title || ""} | ${record.clan || "Unaffiliated"}`,
        linkBuilder: (record) => `character.html?slug=${record.slug}`,
      });
    };

    searchInput.addEventListener("input", render);
    clanSelect.addEventListener("change", render);
    render();
  } catch (error) {
    renderError(target, "Character data is missing. Run npm run build:content.");
  }
}

async function renderCategoryPage() {
  const type = getQueryParam("type") || "clans";
  const slug = getQueryParam("slug");
  const controls = document.getElementById("category-controls");
  const target = document.getElementById("category-list");
  const title = document.getElementById("category-title");
  const desc = document.getElementById("category-description");

  if (!CATEGORY_META[type]) {
    title.textContent = "Unknown Category";
    desc.textContent = "This category does not exist.";
    renderError(target, "Use clans, towns, mesas, or regions.");
    return;
  }

  title.textContent = CATEGORY_META[type].label;
  desc.textContent = CATEGORY_META[type].description;

  try {
    const records = await loadJson(type);

    if (slug) {
      const record = records.find((entry) => entry.slug === slug);
      if (!record) {
        renderError(target, `Entry not found in ${type}.`);
        return;
      }

      const primaryTitle = record.name || record.title || record.slug;
      const metaItems = Object.entries(record)
        .filter(([key, value]) => !["slug", "category", "body", "bodyHtml", "name", "title"].includes(key) && value)
        .map(([key, value]) => {
          const displayValue = Array.isArray(value) ? value.join(" | ") : value;
          return `<li><strong>${escapeHtml(formatMetaLabel(key))}:</strong> ${escapeHtml(displayValue)}</li>`;
        })
        .join("");

      let membersSection = "";
      if (type === "clans") {
        const characters = await loadJson("characters");
        const clanMembers = characters.filter((char) => char.clan === primaryTitle);
        if (clanMembers.length > 0) {
          const membersHtml = clanMembers
            .map((member) => `<li><a href="character.html?slug=${member.slug}">${escapeHtml(member.name || member.title)}</a></li>`)
            .join("");
          membersSection = `
            <details class="members-dropdown">
              <summary><strong>Members (${clanMembers.length})</strong></summary>
              <ul class="members-list">${membersHtml}</ul>
            </details>
          `;
        }
      }

      title.textContent = primaryTitle;
      desc.textContent = `Detailed entry from ${CATEGORY_META[type].label}.`;
      document.title = `${primaryTitle} | ${CATEGORY_META[type].label} | World Index`;

      target.innerHTML = `<article class="card entry-detail">
        <p><a href="category.html?type=${type}">Back to ${escapeHtml(CATEGORY_META[type].label)}</a></p>
        ${metaItems ? `<ul class="entry-meta-list">${metaItems}</ul>` : ""}
        ${membersSection}
        <section class="entry-body">${record.bodyHtml || "<p>No description available.</p>"}</section>
      </article>`;
      return;
    }

    const filterKey = type === "regions" ? "climate" : "region";
    const filterLabel = type === "regions" ? "Climate" : "Region";
    const filterOptions = uniqueValues(records, filterKey);

    createFilterPanel(
      controls,
      [
        `<label class="filter-field"><span>Search</span><input data-category-search type="search" placeholder="Search entries, tags, and details..." /></label>`,
        `<label class="filter-field"><span>${escapeHtml(filterLabel)}</span><select data-category-filter><option value="">All ${escapeHtml(filterLabel)}s</option>${filterOptions.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}</select></label>`,
      ],
      `${records.length} entries available`
    );

    const searchInput = controls.querySelector("[data-category-search]");
    const filterSelect = controls.querySelector("[data-category-filter]");
    const summary = controls.querySelector("[data-filter-summary]");

    const render = () => {
      const query = normalizeText(searchInput.value);
      const filterValue = filterSelect.value;

      const filtered = records.filter((record) => {
        const matchesSearch = !query || toSearchableText(record).includes(query);
        const matchesFilter = !filterValue || normalizeText(record[filterKey]) === normalizeText(filterValue);
        return matchesSearch && matchesFilter;
      });

      summary.textContent = `${filtered.length} of ${records.length} entries shown`;

      target.innerHTML = renderCards(filtered, {
        kind: type,
        titleKey: "name",
        metaBuilder: (record) => {
          const region = record.region ? `Region: ${record.region}` : "";
          const tags = tagsToString(record.tags);
          return [region, tags].filter(Boolean).join(" | ");
        },
        linkBuilder: (record) => `category.html?type=${type}&slug=${record.slug}`,
      });
    };

    searchInput.addEventListener("input", render);
    filterSelect.addEventListener("change", render);
    render();
  } catch (error) {
    renderError(target, `Data for ${type} is missing. Run npm run build:content.`);
  }
}

async function renderCharacterPage() {
  const slug = getQueryParam("slug");
  const target = document.getElementById("character-detail");

  if (!slug) {
    renderError(target, "No character selected. Open from the Characters page.");
    return;
  }

  try {
    const characters = await loadJson("characters");
    const clans = await loadJson("clans");
    const towns = await loadJson("towns");
    
    const character = characters.find((entry) => entry.slug === slug);

    if (!character) {
      renderError(target, "Character not found.");
      return;
    }

    document.title = `${character.name} | World Index`;

    const tags = tagsToString(character.tags);

    // Find clan slug by matching name
    const clanRecord = clans.find((c) => c.name === character.clan);
    const clanLink = clanRecord 
      ? `<a href="category.html?type=clans&slug=${clanRecord.slug}">${escapeHtml(character.clan)}</a>`
      : escapeHtml(character.clan || "None");

    // Find town slug by matching name
    const townName = Array.isArray(character.home_town) ? character.home_town.join(", ") : character.home_town;
    const townRecord = towns.find((t) => t.name === townName);
    const townLink = townRecord
      ? `<a href="category.html?type=towns&slug=${townRecord.slug}">${escapeHtml(townName)}</a>`
      : escapeHtml(townName || "Unknown");

    target.innerHTML = `<article class="character-frame">
      <div class="character-composition">
        <section class="character-closeup-portrait" aria-label="Character closeup portrait">
          <img src="${escapeHtml(character.portrait || "assets/images/sean-closeup.svg")}" alt="${escapeHtml(character.name)} closeup portrait" loading="lazy" />
        </section>
        <section class="character-fullbody" aria-label="Full body portrait">
          <img src="${escapeHtml(character.full_body || "assets/images/sean-full.svg")}" alt="${escapeHtml(character.name)} full body illustration" loading="lazy" />
        </section>
      </div>
      <div class="character-bio">
            <h1 class="character-name">${escapeHtml(character.name || "Unknown")}</h1>
            <p class="character-title">${escapeHtml(character.title || "Unknown Title")}</p>
            <ul class="character-meta-list">
              <li><strong>Clan:</strong> ${clanLink}</li>
              <li><strong>Home:</strong> ${townLink}</li>
              <li><strong>Tags:</strong> ${escapeHtml(tags || "None")}</li>
            </ul>
            <section class="character-body">${character.bodyHtml || "<p>No biography available yet.</p>"}</section>
      </div>
    </article>`;
  } catch (error) {
    renderError(target, "Character data is missing. Run npm run build:content.");
  }
}

async function bootstrap() {
  setActiveNav();

  const page = document.body.dataset.page;
  if (page === "home") {
    await renderHomePage();
    return;
  }

  if (page === "world") {
    renderWorldTiles();
    return;
  }

  if (page === "characters") {
    await renderCharactersPage();
    return;
  }

  if (page === "category") {
    await renderCategoryPage();
    return;
  }

  if (page === "character") {
    await renderCharacterPage();
  }
}

bootstrap();
