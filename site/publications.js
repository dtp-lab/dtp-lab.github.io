(async function () {
  const { escapeHtml, loadJson, dateValue, showDataError, applyPageHeading } = DTPLab;
  const { publicationTypeLabels: typeLabels, renderPublicationCard } = DTPLab.recordRenderers;
  const root = document.querySelector("#publications-content");
  const search = document.querySelector("#publication-search");
  let citations = { papers: {} };
  let publications = [];
  const renderCard = (item, headingLevel = 4) => renderPublicationCard(item, { headingLevel, citations });

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

  const renderCards = (items) => {
    const renderYearGroups = (records) => groupByPublicationYear(records).map((group) => `<section class="publication-year">
      <header class="publication-year-heading"><h3>${escapeHtml(group.label)}</h3><span>${group.items.length}건</span></header>
      ${group.items.map(renderCard).join("")}
    </section>`).join("");
    const renderTypeSection = (type) => {
      const records = items.filter((item) => item.type === type);
      const orderedRecords = type === "patent"
        ? [...records].sort((a, b) => dateValue(b.applicationDate) - dateValue(a.applicationDate))
        : records;
      const content = type === "patent" ? orderedRecords.map((item) => renderCard(item, 3)).join("") : renderYearGroups(orderedRecords);
      return `<section id="${type}" class="publication-type-section type-section-${type}">
        <header class="publication-section-heading"><h2>${typeLabels[type]}</h2><span>${records.length}건</span></header>
        ${content || '<p class="empty-state">등록된 실적이 없습니다.</p>'}
      </section>`;
    };
    return `<div class="publication-cards-view">${["journal", "conference", "patent"].map(renderTypeSection).join("")}</div>`;
  };

  const matchesSearch = (item, query) => {
    if (!query) return true;
    const haystack = [
      item.title,
      item.venue,
      item.details,
      item.applicationNumber,
      item.registrationNumber,
      item.applicationDate,
      item.registrationDate,
      item.patentMetrics?.jurisdiction,
      item.patentMetrics?.status,
      item.publishedAt,
      item.type,
      item.journalMetrics?.indexing,
      item.journalMetrics?.quartile,
      item.journalMetrics?.award,
      item.conferenceMetrics?.conferenceType,
      item.conferenceMetrics?.bk21,
      item.conferenceMetrics?.kiise,
      item.patentMetrics?.jurisdiction,
      item.patentMetrics?.status,
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
    root.innerHTML = renderCards(filtered);
  };

  try {
    const [data, cache] = await Promise.all([loadJson("publications.json"), loadJson("citations.json")]);
    applyPageHeading(data.page);
    citations = cache;
    publications = data.items || [];
    render();
  } catch (error) {
    showDataError(root, error);
  }
  search?.addEventListener("input", render);
})();
