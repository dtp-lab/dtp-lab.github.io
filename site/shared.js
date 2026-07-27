(function () {
  const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);

  const sitePath = (value = "") => {
    const stringValue = String(value);
    if (!stringValue || /^(?:[a-z]+:|\/|#)/i.test(stringValue)) return stringValue;
    return `/${stringValue.replace(/^\.?\//, "")}`;
  };

  const loadJson = async (name) => {
    const response = await fetch(`/data/${name}`);
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    return response.json();
  };

  const dateValue = (value = "") => Number(String(value).replace(/[^0-9]/g, "").padEnd(8, "0")) || 0;
  const sortByDateDesc = (items, getter = (item) => item.date) => [...items].sort((a, b) => dateValue(getter(b)) - dateValue(getter(a)));
  const groupByYear = (items, getter = (item) => item.date) => sortByDateDesc(items, getter).reduce((groups, item) => {
    // A trailing space keeps numeric-looking year keys in insertion order.
    // JavaScript otherwise reorders integer object keys from oldest to newest.
    const year = `${String(getter(item) || "Other").slice(0, 4)} `;
    (groups[year] ||= []).push(item);
    return groups;
  }, {});

  const renderKeywords = (keywords = [], { baselineProbe = false } = {}) => keywords.length
    ? `<div class="keyword-row">${keywords.map((keyword) => `<span class="keyword">${baselineProbe ? '<span class="record-meta-baseline-probe" aria-hidden="true"></span>' : ""}<span class="keyword-label">${escapeHtml(keyword)}</span></span>`).join("")}</div>`
    : "";

  const imageMarkup = (image, fallbackAlt = "") => {
    if (!image) return "";
    const source = typeof image === "string" ? image : image.src;
    const alt = typeof image === "string" ? fallbackAlt : (image.alt || fallbackAlt);
    return source ? `<img src="${escapeHtml(sitePath(source))}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" />` : "";
  };

  const showDataError = (container, error) => {
    console.error(error);
    if (container) container.innerHTML = '<p class="data-error">콘텐츠를 불러오지 못했습니다.</p>';
  };

  const setupShell = () => {
    const page = document.body.dataset.page;
    document.querySelectorAll("[data-nav]").forEach((link) => {
      if (link.dataset.nav === page) link.setAttribute("aria-current", "page");
    });

    const toggle = document.querySelector(".menu-toggle");
    const nav = document.querySelector("#site-nav");
    const closeMenu = () => {
      if (!toggle || !nav) return;
      nav.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
      document.body.classList.remove("menu-open");
    };
    toggle?.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
      document.body.classList.toggle("menu-open", open);
    });
    nav?.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
    });
    document.querySelectorAll("[data-current-year]").forEach((element) => {
      element.textContent = new Date().getFullYear();
    });

    document.querySelectorAll("details").forEach((details) => {
      const update = () => details.querySelector("summary")?.setAttribute("aria-expanded", String(details.open));
      update();
      details.addEventListener("toggle", update);
    });
  };

  window.DTPLab = { escapeHtml, sitePath, loadJson, dateValue, sortByDateDesc, groupByYear, renderKeywords, imageMarkup, showDataError };
  document.addEventListener("DOMContentLoaded", setupShell);
})();
