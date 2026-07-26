(async function () {
  const { escapeHtml, loadJson, dateValue, renderKeywords, showDataError } = DTPLab;
  const root = document.querySelector("#publications-content");
  const search = document.querySelector("#publication-search");
  const layoutButtons = [...document.querySelectorAll("[data-publication-layout]")];
  let citations = { papers: {} };
  let publications = [];
  let activeLayout = "legacy";
  const typeLabels = { journal: "Journal", conference: "Conference", patent: "Patent" };
  const icons = {
    authors: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M16 4a4 4 0 0 1 0 8M17 14a7 7 0 0 1 5 7"/></svg>',
    venue: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h10l4 4v14H5z"/><path d="M15 3v5h5M8 12h8M8 16h8"/></svg>',
    keywords: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m20.5 13.5-7 7a2 2 0 0 1-2.8 0L3 12.8V3h9.8l7.7 7.7a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.2"/></svg>',
  };

  const renderAuthor = (author) => {
    const symbols = `${author.isFirstAuthor ? '<sup class="author-symbol" title="제1저자" aria-label="제1저자">†</sup>' : ""}${author.isCorrespondingAuthor ? '<sup class="author-symbol" title="교신저자" aria-label="교신저자">*</sup>' : ""}`;
    return `<span class="author${author.isLabMember ? " lab-member" : ""}">${escapeHtml(author.name)}${symbols}</span>`;
  };

  const evaluationTag = (item) => {
    const indexing = item.metrics?.indexing;
    if (!indexing) return "";
    let label = indexing;
    let className = indexing.toLowerCase();
    if (indexing === "SCIE" && item.metrics?.topPercent) {
      label = `SCIE-TOP${item.metrics.topPercent}%`;
      className = `scie-top${String(item.metrics.topPercent).replace(/[^0-9]/g, "")}`;
    } else if (indexing === "SCIE" && item.metrics?.quartile) {
      label = `SCIE-${item.metrics.quartile}`;
      className = ["Q1", "Q2"].includes(item.metrics.quartile) ? `scie-${item.metrics.quartile.toLowerCase()}` : "scie";
    }
    if (item.metrics?.metricYear) label += ` · ${item.metrics.metricYear}`;
    return `<span class="publication-tag evaluation evaluation-${escapeHtml(className)}">${escapeHtml(label)}</span>`;
  };

  const patentStatusClass = (status) => ({ "등록": "patent-registered", "출원": "patent-applied", PCT: "patent-pct" })[status] || "patent-other";

  const renderTags = (item) => {
    const featureTags = [
      evaluationTag(item),
      item.metrics?.award ? `<span class="publication-tag evaluation evaluation-award">${escapeHtml(item.metrics.award)}</span>` : "",
      item.patentStatus ? `<span class="publication-tag patent-status ${patentStatusClass(item.patentStatus)}">${escapeHtml(item.patentStatus)}</span>` : "",
    ].filter(Boolean);
    const fallback = `<span class="publication-tag type-${escapeHtml(item.type)}">${escapeHtml(typeLabels[item.type] || item.type)}</span>`;
    return (featureTags.length ? featureTags : [fallback]).join("");
  };

  const getLinks = (item) => {
    const links = [...(item.links || [])];
    if (item.doi) links.unshift({ label: "DOI", url: `https://doi.org/${item.doi}` });
    const citation = citations.papers?.[item.id];
    if (citation?.url && !links.some((link) => link.url === citation.url)) links.push({ label: "S2", url: citation.url });
    return links;
  };

  const renderLinks = (item) => {
    const links = getLinks(item);
    return links.length ? `<nav class="publication-links" aria-label="외부 링크">${links.map((link) => `<a class="icon-link" href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer" title="${escapeHtml(link.label)}">${escapeHtml(link.label)}</a>`).join("")}</nav>` : "";
  };

  const renderCitation = (item) => {
    const citation = citations.papers?.[item.id];
    return Number.isInteger(citation?.citationCount)
      ? `<span class="publication-citation">Cited by ${citation.citationCount}${citation.checkedAt ? ` · ${escapeHtml(citation.checkedAt)}` : ""}</span>`
      : "";
  };

  const renderAuthors = (item) => item.authors?.length
    ? `<p class="authors">${item.authors.map(renderAuthor).join(", ")}</p>`
    : "";

  const renderTimelineItem = (item) => {
    const venue = [item.venue, item.details, item.publishedAt].filter(Boolean).map(escapeHtml).join(" · ");
    return `<article class="publication-timeline-item">
      <span class="publication-marker" aria-hidden="true"></span>
      <div class="publication-timeline-head">
        <div class="publication-timeline-title"><div class="publication-tags">${renderTags(item)}</div><h3>${escapeHtml(item.title)}</h3></div>
        ${renderLinks(item)}
      </div>
      <div class="publication-timeline-authors">${renderAuthors(item)}</div>
      <div class="publication-timeline-meta">
        ${venue ? `<span class="publication-meta-item publication-venue-item"><span class="publication-row-icon">${icons.venue}</span><span class="publication-venue">${venue}</span></span>` : ""}
        ${renderCitation(item)}
        ${item.keywords?.length ? `<span class="publication-meta-item publication-keywords-item"><span class="publication-row-icon">${icons.keywords}</span>${renderKeywords(item.keywords)}</span>` : ""}
      </div>
    </article>`;
  };

  const renderLegacyCard = (item, headingLevel = 4) => {
    const heading = headingLevel === 3 ? "h3" : "h4";
    const authors = item.authors?.length ? `<div class="publication-detail-row publication-authors-row"><span class="publication-row-icon">${icons.authors}</span>${renderAuthors(item)}</div>` : "";
    const venueText = [item.venue, item.details, item.publishedAt].filter(Boolean).map(escapeHtml).join(" · ");
    const venue = venueText ? `<span class="publication-meta-item publication-venue-item"><span class="publication-row-icon">${icons.venue}</span><span class="publication-venue">${venueText}</span></span>` : "";
    const keywords = item.keywords?.length ? `<span class="publication-meta-item publication-keywords-item"><span class="publication-row-icon">${icons.keywords}</span>${renderKeywords(item.keywords)}</span>` : "";
    return `<article class="publication-card">
      <div class="publication-top">
        <div class="publication-heading-line"><div class="publication-tags">${renderTags(item)}</div><${heading}>${escapeHtml(item.title)}</${heading}></div>
        ${renderLinks(item)}
      </div>
      ${authors}
      <div class="publication-lower-row">${venue}${renderCitation(item)}${keywords}</div>
    </article>`;
  };

  const groupByPublicationYear = (items) => {
    const sorted = [...items].sort((a, b) => dateValue(b.publishedAt) - dateValue(a.publishedAt));
    return sorted.reduce((groups, item) => {
      const numericYear = Number(String(item.publishedAt).slice(0, 4));
      const label = numericYear >= 2020 ? String(numericYear) : "2020년 이전";
      const existing = groups.find((group) => group.label === label);
      if (existing) existing.items.push(item);
      else groups.push({ label, items: [item] });
      return groups;
    }, []);
  };

  const renderTimeline = (items) => `<div class="publication-timeline-view">${groupByPublicationYear(items).map((group) => `<section class="publication-timeline-year">
    <header class="publication-year-rail"><h2>${escapeHtml(group.label)}</h2><span>${group.items.length}</span></header>
    <div class="publication-timeline-list">${group.items.map(renderTimelineItem).join("")}</div>
  </section>`).join("")}</div>`;

  const renderLegacy = (items) => {
    const renderYearGroups = (records) => groupByPublicationYear(records).map((group) => `<section class="publication-year">
      <header class="publication-year-heading"><h3>${escapeHtml(group.label)}</h3><span>${group.items.length}건</span></header>
      ${group.items.map(renderLegacyCard).join("")}
    </section>`).join("");
    const renderTypeSection = (type) => {
      const records = items.filter((item) => item.type === type);
      const content = type === "patent" ? records.map((item) => renderLegacyCard(item, 3)).join("") : renderYearGroups(records);
      return `<section class="publication-type-section type-section-${type}">
        <header class="publication-section-heading"><h2>${typeLabels[type]}</h2><span>${records.length}건</span></header>
        ${content || '<p class="empty-state">등록된 실적이 없습니다.</p>'}
      </section>`;
    };
    return `<div class="publication-legacy-view">${["journal", "conference", "patent"].map(renderTypeSection).join("")}</div>`;
  };

  const matchesSearch = (item, query) => {
    if (!query) return true;
    const haystack = [
      item.title,
      item.venue,
      item.details,
      item.publishedAt,
      item.type,
      item.patentStatus,
      ...(item.authors || []).map((author) => author.name),
      ...(item.keywords || []),
    ].filter(Boolean).join(" ").toLocaleLowerCase();
    return haystack.includes(query.toLocaleLowerCase());
  };

  const render = () => {
    const query = search?.value.trim() || "";
    const filtered = publications.filter((item) => matchesSearch(item, query));
    if (!filtered.length) {
      root.innerHTML = '<p class="empty-state">검색 조건에 맞는 연구 성과가 없습니다.</p>';
      return;
    }
    root.innerHTML = renderTimeline(filtered) + renderLegacy(filtered);
    root.querySelector(".publication-timeline-view")?.toggleAttribute("hidden", activeLayout !== "timeline");
    root.querySelector(".publication-legacy-view")?.toggleAttribute("hidden", activeLayout !== "legacy");
  };

  const setLayout = (layout) => {
    activeLayout = layout;
    layoutButtons.forEach((button) => {
      const active = button.dataset.publicationLayout === layout;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    root.querySelector(".publication-timeline-view")?.toggleAttribute("hidden", layout !== "timeline");
    root.querySelector(".publication-legacy-view")?.toggleAttribute("hidden", layout !== "legacy");
  };

  try {
    const [data, cache] = await Promise.all([loadJson("publications.json"), loadJson("citations.json")]);
    citations = cache;
    publications = data.items || [];
    render();
  } catch (error) {
    showDataError(root, error);
  }

  layoutButtons.forEach((button) => button.addEventListener("click", () => setLayout(button.dataset.publicationLayout)));
  search?.addEventListener("input", render);
})();
