(async function () {
  const { escapeHtml, loadJson, dateValue, renderKeywords, showDataError } = DTPLab;
  const root = document.querySelector("#publications-content");
  let citations = { papers: {} };
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

  const renderCard = (item, headingLevel = 4) => {
    const links = [...(item.links || [])];
    if (item.doi) links.unshift({ label: "DOI", url: `https://doi.org/${item.doi}` });
    const citation = citations.papers?.[item.id];
    if (citation?.url && !links.some((link) => link.url === citation.url)) links.push({ label: "S2", url: citation.url });
    const featureTags = [
      evaluationTag(item),
      item.metrics?.award ? `<span class="publication-tag evaluation evaluation-award">${escapeHtml(item.metrics.award)}</span>` : "",
      item.patentStatus ? `<span class="publication-tag patent-status ${patentStatusClass(item.patentStatus)}">${escapeHtml(item.patentStatus)}</span>` : "",
    ].filter(Boolean);
    const fallbackTypeTag = `<span class="publication-tag type-${escapeHtml(item.type)}">${escapeHtml(typeLabels[item.type] || item.type)}</span>`;
    const topTags = (featureTags.length ? featureTags : [fallbackTypeTag]).join("");
    const citationLabel = Number.isInteger(citation?.citationCount)
      ? `<span class="publication-citation">Semantic Scholar citations ${citation.citationCount}${citation.checkedAt ? ` · ${escapeHtml(citation.checkedAt)}` : ""}</span>`
      : "";
    const heading = headingLevel === 3 ? "h3" : "h4";
    const authors = item.authors?.length ? `<div class="publication-detail-row publication-authors-row"><span class="publication-row-icon">${icons.authors}</span><p class="authors">${item.authors.map(renderAuthor).join(", ")}</p></div>` : "";
    const venue = `<span class="publication-meta-item publication-venue-item"><span class="publication-row-icon">${icons.venue}</span><span class="publication-venue">${[item.venue, item.details, item.publishedAt].filter(Boolean).map(escapeHtml).join(" · ")}</span></span>`;
    const keywords = item.keywords?.length ? `<span class="publication-meta-item publication-keywords-item"><span class="publication-row-icon">${icons.keywords}</span>${renderKeywords(item.keywords)}</span>` : "";
    return `<article class="publication-card"><div class="publication-top"><div class="publication-heading-line"><div class="publication-tags">${topTags}</div><${heading}>${escapeHtml(item.title)}</${heading}></div>${links.length ? `<nav class="publication-links" aria-label="외부 링크">${links.map((link) => `<a class="icon-link" href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer" title="${escapeHtml(link.label)}">${escapeHtml(link.label)}</a>`).join("")}</nav>` : ""}</div>${authors}<div class="publication-lower-row">${venue}${citationLabel}${keywords}</div></article>`;
  };

  const renderYearGroups = (items) => {
    const sorted = [...items].sort((a, b) => dateValue(b.publishedAt) - dateValue(a.publishedAt));
    const recentYears = [...new Set(sorted.map((item) => Number(item.publishedAt.slice(0, 4))).filter((year) => year >= 2020))].sort((a, b) => b - a);
    const groups = recentYears.map((year) => ({ label: String(year), items: sorted.filter((item) => item.publishedAt.startsWith(String(year))) }));
    const before2020 = sorted.filter((item) => Number(item.publishedAt.slice(0, 4)) < 2020);
    if (before2020.length) groups.push({ label: "2020년 이전", items: before2020 });
    return groups.map((group) => `<section class="publication-year"><header class="publication-year-heading"><h3>${escapeHtml(group.label)}</h3><span>${group.items.length}건</span></header>${group.items.map(renderCard).join("")}</section>`).join("");
  };

  const renderTypeSection = (type, items) => {
    const records = items.filter((item) => item.type === type).sort((a, b) => dateValue(b.publishedAt) - dateValue(a.publishedAt));
    const content = type === "patent" ? records.map((item) => renderCard(item, 3)).join("") : renderYearGroups(records);
    return `<section class="publication-type-section type-section-${type}"><header class="publication-section-heading"><h2>${typeLabels[type]}</h2><span>${records.length}건</span></header>${content || '<p class="empty-state">등록된 실적이 없습니다.</p>'}</section>`;
  };

  try {
    const [data, cache] = await Promise.all([loadJson("publications.json"), loadJson("citations.json")]);
    citations = cache;
    const items = data.items || [];
    root.innerHTML = ["journal", "conference", "patent"].map((type) => renderTypeSection(type, items)).join("");
  } catch (error) { showDataError(root, error); }
})();
